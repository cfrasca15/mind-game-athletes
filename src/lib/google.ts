import { importPKCS8, SignJWT } from "jose";

/**
 * Minimal Google Calendar client for a service account. No SDK: one signed
 * JWT exchanged for an access token, then plain REST calls.
 *
 * The two URLs can be overridden by env for local testing against a mock.
 */
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token";
const API_BASE = process.env.GOOGLE_CALENDAR_API ?? "https://www.googleapis.com/calendar/v3";
// The audience Google expects in the signed request, whatever URL we post to.
const TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TIMEOUT_MS = 8000;

export type GoogleCreds = { clientEmail: string; privateKey: string };

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

/** Reads the JSON key file Google Cloud downloads for a service account. */
export function parseServiceAccountKey(raw: string): GoogleCreds {
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
  return { clientEmail: k.client_email, privateKey: k.private_key };
}

const tokens = new Map<string, { token: string; expiresAt: number }>();

async function accessToken(creds: GoogleCreds): Promise<string> {
  const cached = tokens.get(creds.clientEmail);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  let key;
  try {
    key = await importPKCS8(creds.privateKey, "RS256");
  } catch {
    throw new GoogleError("The private key in the key file could not be read. Create a new JSON key in Google Cloud and paste it again.", 0, "badKey");
  }
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(creds.clientEmail)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await send(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new GoogleError(
      "Google rejected the key. It may have been deleted in Google Cloud. Create a new JSON key and connect again.",
      res.status,
      body.error ?? "token",
    );
  }
  tokens.set(creds.clientEmail, { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 });
  return body.access_token;
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new GoogleError("Could not reach Google. Check the server's internet connection and try again.", 0, "network");
  }
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

  if (res.status === 401) tokens.delete(creds.clientEmail);
  const reason = json.error?.errors?.[0]?.reason ?? json.error?.status ?? "";
  const detail = json.error?.message ?? "";
  throw new GoogleError(friendly(res.status, reason, detail, creds.clientEmail), res.status, reason);
}

function friendly(status: number, reason: string, detail: string, clientEmail: string): string {
  if (status === 403 && (reason === "accessNotConfigured" || /has not been used|is disabled/i.test(detail))) {
    return "The Google Calendar API is not turned on for this Google Cloud project yet. Enable it in Google Cloud, wait a minute, and try again.";
  }
  if (status === 403) {
    return `Google would not allow changes to that calendar. In the calendar's sharing settings, give ${clientEmail} the permission "Make changes to events".`;
  }
  if (status === 404) {
    return `Google could not find that calendar. Check the calendar ID, and that the calendar is shared with ${clientEmail}.`;
  }
  if (status === 401) return "Google no longer accepts the key. Create a new JSON key in Google Cloud and connect again.";
  if (status === 429 || status >= 500) return "Google is busy right now. The session will sync the next time it is saved, or use Sync now in Settings.";
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
