import { importPKCS8, SignJWT } from "jose";

/**
 * Minimal Google Calendar client. No SDK: get an access token, then plain
 * REST calls. There are two ways to get that token:
 *
 *   oauth    she signed in with Google (Settings, "Connect Google Calendar")
 *   service  a service account key was pasted in (the other way to connect)
 *
 * The URLs can be overridden by env for local testing against a mock.
 */
const AUTH_URL = process.env.GOOGLE_AUTH_URL ?? "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token";
const USERINFO_URL = process.env.GOOGLE_USERINFO_URL ?? "https://www.googleapis.com/oauth2/v2/userinfo";
const API_BASE = process.env.GOOGLE_CALENDAR_API ?? "https://www.googleapis.com/calendar/v3";
// The audience Google expects in a service account's signed request, whatever URL we post to.
const TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";
const TIMEOUT_MS = 8000;

/** The main calendar of whoever signed in. */
export const PRIMARY_CALENDAR = "primary";

export type OAuthCreds = { kind: "oauth"; refreshToken: string };
export type ServiceCreds = { kind: "service"; clientEmail: string; privateKey: string };
export type GoogleCreds = OAuthCreds | ServiceCreds;

export type GoogleEvent = {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  extendedProperties?: { private: Record<string, string> };
};

export class GoogleError extends Error {
  constructor(
    message: string,
    public status: number,
    public reason: string = "",
  ) {
    super(message);
  }
  get notFound() {
    return this.status === 404 || this.status === 410;
  }
}

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };

const tokens = new Map<string, { token: string; expiresAt: number }>();
const cacheKey = (c: GoogleCreds) => (c.kind === "oauth" ? `oauth:${c.refreshToken}` : `service:${c.clientEmail}`);

function remember(creds: GoogleCreds, body: TokenResponse): string {
  tokens.set(cacheKey(creds), { token: body.access_token!, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 });
  return body.access_token!;
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new GoogleError("Could not reach Google. Check the server's internet connection and try again.", 0, "network");
  }
}

function postForm(url: string, fields: Record<string, string>): Promise<Response> {
  return send(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

// ---------------------------------------------------------------------------
// Signing in with Google
// ---------------------------------------------------------------------------

/**
 * The Google sign-in settings from the server's environment, or null when
 * they are not all there. Same three names as medicare-crm.
 */
export function oauthSettings() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

const NOT_SET_UP = "Google sign-in is not set up on the server. GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI are needed in its settings file.";
const BAD_CLIENT = "Google did not accept the client ID and secret saved on the server. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in its settings file.";

/** Where to send the browser to sign in. `state` comes back unchanged. */
export function googleSignInUrl(state: string): string {
  const o = oauthSettings();
  if (!o) throw new GoogleError(NOT_SET_UP, 0, "notset");
  const params = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    response_type: "code",
    scope: `${CALENDAR_SCOPE} ${EMAIL_SCOPE}`,
    // offline + consent: Google hands back a long-lived token every time.
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

/** Trades the code Google sent back for a long-lived sign-in. */
export async function finishGoogleSignIn(code: string): Promise<{ creds: OAuthCreds; email: string | null; canEditEvents: boolean }> {
  const o = oauthSettings();
  if (!o) throw new GoogleError(NOT_SET_UP, 0, "notset");
  const res = await postForm(TOKEN_URL, {
    code,
    client_id: o.clientId,
    client_secret: o.clientSecret,
    redirect_uri: o.redirectUri,
    grant_type: "authorization_code",
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !body.access_token) {
    if (body.error === "invalid_client") throw new GoogleError(BAD_CLIENT, res.status, "invalid_client");
    if (body.error === "invalid_grant") throw new GoogleError("The sign-in timed out before it finished. Please try again.", res.status, "invalid_grant");
    throw new GoogleError(`Google sign-in did not finish${body.error ? ` (${body.error})` : ""}. Please try again.`, res.status, body.error ?? "token");
  }
  if (!body.refresh_token) {
    throw new GoogleError("Google did not hand over a lasting sign-in. Please try again.", res.status, "norefresh");
  }
  const creds: OAuthCreds = { kind: "oauth", refreshToken: body.refresh_token };
  const token = remember(creds, body);
  // Google lets people untick individual permissions on its screen.
  const canEditEvents = body.scope ? body.scope.split(" ").includes(CALENDAR_SCOPE) : true;
  return { creds, email: await signedInEmail(token), canEditEvents };
}

/** Which account signed in. Only for display, so a failure is not an error. */
async function signedInEmail(token: string): Promise<string | null> {
  try {
    const res = await send(USERINFO_URL, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const body = (await res.json()) as { email?: string };
    return body.email ?? null;
  } catch {
    return null;
  }
}

async function renewSignIn(creds: OAuthCreds): Promise<string> {
  const o = oauthSettings();
  if (!o) throw new GoogleError(NOT_SET_UP, 0, "notset");
  const res = await postForm(TOKEN_URL, {
    refresh_token: creds.refreshToken,
    client_id: o.clientId,
    client_secret: o.clientSecret,
    grant_type: "refresh_token",
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (res.ok && body.access_token) return remember(creds, body);
  if (body.error === "invalid_grant") {
    throw new GoogleError("Google needs you to sign in again. Open Settings and choose Sign in again.", 401, "invalid_grant");
  }
  if (body.error === "invalid_client") throw new GoogleError(BAD_CLIENT, res.status, "invalid_client");
  if (res.status === 429 || res.status >= 500) throw new GoogleError(BUSY, res.status, "busy");
  throw new GoogleError(`Google would not renew the sign-in${body.error ? ` (${body.error})` : ""}. Open Settings and choose Sign in again.`, res.status, body.error ?? "token");
}

// ---------------------------------------------------------------------------
// Service account
// ---------------------------------------------------------------------------

/** Reads the JSON key file Google Cloud downloads for a service account. */
export function parseServiceAccountKey(raw: string): ServiceCreds {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("That is not the key file. Paste the whole contents of the .json file Google downloaded, starting with { and ending with }.");
  }
  const k = json as { type?: string; client_email?: string; private_key?: string };
  if (k.type !== "service_account" || !k.client_email || !k.private_key) {
    throw new Error("That file is not a service account key. In Google Cloud, open the service account, go to Keys, and create a new JSON key.");
  }
  return { kind: "service", clientEmail: k.client_email, privateKey: k.private_key };
}

async function serviceToken(creds: ServiceCreds): Promise<string> {
  let key;
  try {
    key = await importPKCS8(creds.privateKey, "RS256");
  } catch {
    throw new GoogleError("The private key in the key file could not be read. Create a new JSON key in Google Cloud and paste it again.", 0, "badKey");
  }
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: CALENDAR_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(creds.clientEmail)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await postForm(TOKEN_URL, { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !body.access_token) {
    throw new GoogleError(
      "Google rejected the key. It may have been deleted in Google Cloud. Create a new JSON key and connect again.",
      res.status,
      body.error ?? "token",
    );
  }
  return remember(creds, body);
}

// ---------------------------------------------------------------------------
// Calendar calls
// ---------------------------------------------------------------------------

async function accessToken(creds: GoogleCreds): Promise<string> {
  const cached = tokens.get(cacheKey(creds));
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  return creds.kind === "oauth" ? renewSignIn(creds) : serviceToken(creds);
}

async function call(creds: GoogleCreds, method: string, path: string, body?: unknown): Promise<unknown> {
  const token = await accessToken(creds);
  const res = await send(`${API_BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; errors?: { reason?: string }[]; status?: string } };
  if (res.ok) return json;

  if (res.status === 401) tokens.delete(cacheKey(creds));
  const reason = json.error?.errors?.[0]?.reason ?? json.error?.status ?? "";
  const detail = json.error?.message ?? "";
  throw new GoogleError(friendly(res.status, reason, detail, creds), res.status, reason);
}

const BUSY = "Google is busy right now. The session will sync the next time it is saved, or use Sync now in Settings.";

function friendly(status: number, reason: string, detail: string, creds: GoogleCreds): string {
  const signedIn = creds.kind === "oauth";
  if (status === 403 && (reason === "accessNotConfigured" || /has not been used|is disabled/i.test(detail))) {
    return "The Google Calendar API is not turned on for this Google Cloud project yet. Enable it in Google Cloud, wait a minute, and try again.";
  }
  if (status === 403 && signedIn && (reason === "insufficientPermissions" || /insufficient.*scope/i.test(detail))) {
    return "Google was not given permission to add events. Choose Sign in again and leave the calendar box ticked on Google's screen.";
  }
  if (status === 403) {
    return signedIn
      ? "The Google account that is signed in cannot change that calendar. Its owner needs to share it with \"Make changes to events\"."
      : `Google would not allow changes to that calendar. In the calendar's sharing settings, give ${creds.clientEmail} the permission "Make changes to events".`;
  }
  if (status === 404) {
    return signedIn
      ? "Google could not find that calendar. Check the calendar ID, and that it is shared with the account that is signed in."
      : `Google could not find that calendar. Check the calendar ID, and that the calendar is shared with ${creds.clientEmail}.`;
  }
  if (status === 401) {
    return signedIn
      ? "Google needs you to sign in again. Open Settings and choose Sign in again."
      : "Google no longer accepts the key. Create a new JSON key in Google Cloud and connect again.";
  }
  if (status === 429 || status >= 500) return BUSY;
  return `Google returned an error (${status}${detail ? `: ${detail}` : ""}).`;
}

const cal = (calendarId: string) => `/calendars/${encodeURIComponent(calendarId)}/events`;

export async function insertEvent(creds: GoogleCreds, calendarId: string, event: GoogleEvent): Promise<string> {
  const res = (await call(creds, "POST", cal(calendarId), event)) as { id: string };
  return res.id;
}

export async function updateEvent(creds: GoogleCreds, calendarId: string, eventId: string, event: GoogleEvent): Promise<void> {
  // status: confirmed also restores an event someone deleted in Google.
  await call(creds, "PATCH", `${cal(calendarId)}/${encodeURIComponent(eventId)}`, { ...event, status: "confirmed" });
}

/** Deleting something already gone counts as done. */
export async function deleteEvent(creds: GoogleCreds, calendarId: string, eventId: string): Promise<void> {
  try {
    await call(creds, "DELETE", `${cal(calendarId)}/${encodeURIComponent(eventId)}`);
  } catch (e) {
    if (e instanceof GoogleError && e.notFound) return;
    throw e;
  }
}

/** Proves we can write to the calendar by adding and removing a throwaway event. */
export async function testCalendarAccess(creds: GoogleCreds, calendarId: string): Promise<void> {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const id = await insertEvent(creds, calendarId, {
    summary: "Mind Game Athletes connection test (safe to delete)",
    start: { dateTime: start.toISOString() },
    end: { dateTime: new Date(start.getTime() + 15 * 60 * 1000).toISOString() },
  });
  await deleteEvent(creds, calendarId, id);
}
