import { prisma } from "@/lib/prisma";
import {
  deleteEvent,
  insertEvent,
  updateEvent,
  testCalendarAccess,
  GoogleError,
  PRIMARY_CALENDAR,
  type GoogleCreds,
  type GoogleEvent,
  type OAuthCreds,
} from "@/lib/google";
import { SESSION_TYPE_LABEL } from "@/lib/format";

/**
 * One-way mirror of sessions onto a Google Calendar. The CRM is the source of
 * truth: nothing is ever read back from Google.
 *
 * Nothing in here throws. A Google outage must never stop her saving a
 * session, so failures are recorded on the session and shown in Settings.
 */

type Config = NonNullable<Awaited<ReturnType<typeof getConfig>>>;

/** The saved connection plus how to sign in with it, or null when not connected. */
async function getConfig() {
  const row = await prisma.googleCalendar.findUnique({ where: { id: 1 } });
  if (!row) return null;
  const creds: GoogleCreds | null = row.refreshToken
    ? { kind: "oauth", refreshToken: row.refreshToken }
    : row.clientEmail && row.privateKey
      ? { kind: "service", clientEmail: row.clientEmail, privateKey: row.privateKey }
      : null;
  return creds ? { ...row, creds } : null;
}

const sessionInclude = {
  client: { select: { firstName: true, lastName: true } },
  team: { select: { name: true } },
} as const;

type SyncSession = NonNullable<Awaited<ReturnType<typeof loadSession>>>;

function loadSession(id: string) {
  return prisma.session.findUnique({ where: { id }, include: sessionInclude });
}

/**
 * What goes on Google. Deliberately thin: who, when, where. The session
 * title, plan and notes stay in the CRM because these are minors and a
 * calendar is easy to share by accident.
 */
function eventFor(cfg: Config, s: SyncSession): GoogleEvent {
  const who = s.client
    ? cfg.fullNames
      ? `${s.client.firstName} ${s.client.lastName}`
      : `${s.client.firstName} ${s.client.lastName.charAt(0)}.`
    : (s.team?.name ?? "Session");
  const prefix = s.status === "NO_SHOW" ? "No-show: " : s.team ? "Team session: " : "Session: ";
  const lines = [`${SESSION_TYPE_LABEL[s.type]} · ${s.durationMin} min`];
  if (cfg.appUrl) lines.push(`Open in the CRM: ${cfg.appUrl}/sessions/${s.id}`);
  return {
    summary: `${prefix}${who}`,
    description: lines.join("\n"),
    location: s.location ?? undefined,
    start: { dateTime: s.startsAt.toISOString() },
    end: { dateTime: new Date(s.startsAt.getTime() + s.durationMin * 60_000).toISOString() },
    extendedProperties: { private: { mgaSessionId: s.id } },
  };
}

async function pushOne(cfg: Config, s: SyncSession): Promise<boolean> {
  try {
    let eventId: string | null = s.googleEventId;
    if (s.status === "CANCELLED") {
      if (eventId) await deleteEvent(cfg.creds, cfg.calendarId, eventId);
      eventId = null;
    } else {
      const event = eventFor(cfg, s);
      if (eventId) {
        try {
          await updateEvent(cfg.creds, cfg.calendarId, eventId, event);
        } catch (e) {
          // Event was removed on the Google side: put it back.
          if (!(e instanceof GoogleError && e.notFound)) throw e;
          eventId = await insertEvent(cfg.creds, cfg.calendarId, event);
        }
      } else {
        eventId = await insertEvent(cfg.creds, cfg.calendarId, event);
      }
    }
    // updateMany: the session may have been deleted while we were talking to Google.
    await prisma.session.updateMany({ where: { id: s.id }, data: { googleEventId: eventId, googleSyncError: null } });
    return true;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error talking to Google.";
    await prisma.session.updateMany({ where: { id: s.id }, data: { googleSyncError: message } }).catch(() => {});
    await prisma.googleCalendar.updateMany({ where: { id: 1 }, data: { lastError: message, lastErrorAt: new Date() } }).catch(() => {});
    return false;
  }
}

async function markSynced() {
  await prisma.googleCalendar.updateMany({ where: { id: 1 }, data: { lastSyncAt: new Date() } }).catch(() => {});
}

/** Call after a session is created or its time, place, status or owner changes. */
export async function syncSession(id: string): Promise<void> {
  try {
    const cfg = await getConfig();
    if (!cfg) return;
    const s = await loadSession(id);
    if (!s) return;
    if (await pushOne(cfg, s)) await markSynced();
  } catch {
    // Never let calendar sync break a save.
  }
}

/** Call with the event ids of sessions that are about to be / were deleted. */
export async function removeEvents(eventIds: (string | null)[]): Promise<void> {
  try {
    const ids = eventIds.filter((x): x is string => !!x);
    if (ids.length === 0) return;
    const cfg = await getConfig();
    if (!cfg) return;
    for (const id of ids) {
      try {
        await deleteEvent(cfg.creds, cfg.calendarId, id);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error talking to Google.";
        await prisma.googleCalendar.updateMany({
          where: { id: 1 },
          data: { lastError: `A deleted session may still be on Google Calendar. ${message}`, lastErrorAt: new Date() },
        });
      }
    }
  } catch {
    // Same rule: never break the delete.
  }
}

/** Sessions that belong on the calendar going forward. */
function upcomingWhere(owner: { clientId?: string; teamId?: string } = {}) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return {
    ...owner,
    startsAt: { gte: startOfToday },
    OR: [{ status: "SCHEDULED" as const }, { googleEventId: { not: null } }, { googleSyncError: { not: null } }],
  };
}

/**
 * Push every upcoming session (optionally just one player's or team's, e.g.
 * after a rename). Also retries anything that failed earlier.
 */
export async function syncUpcoming(owner: { clientId?: string; teamId?: string } = {}): Promise<{ ok: number; failed: number }> {
  const result = { ok: 0, failed: 0 };
  try {
    const cfg = await getConfig();
    if (!cfg) return result;
    const list = await prisma.session.findMany({ where: upcomingWhere(owner), include: sessionInclude, orderBy: { startsAt: "asc" } });
    for (const s of list) {
      // A cancelled session with nothing on Google needs no call.
      if (s.status === "CANCELLED" && !s.googleEventId) {
        if (s.googleSyncError) await prisma.session.updateMany({ where: { id: s.id }, data: { googleSyncError: null } });
        continue;
      }
      if (await pushOne(cfg, s)) result.ok++;
      else result.failed++;
    }
    if (result.ok > 0) await markSynced();
    if (result.failed === 0) await prisma.googleCalendar.updateMany({ where: { id: 1 }, data: { lastError: null, lastErrorAt: null } });
  } catch {
    // fall through with whatever we counted
  }
  return result;
}

/**
 * Saves a connection that has already been tested, then pushes what is
 * booked. If the events will now land somewhere else, the old event ids are
 * forgotten so everything is created fresh there.
 */
export async function saveConnection(input: {
  creds: GoogleCreds;
  accountEmail?: string | null;
  calendarId: string;
  appUrl: string | null;
  fullNames?: boolean;
}): Promise<{ ok: number; failed: number }> {
  const { creds, calendarId } = input;
  const accountEmail = creds.kind === "oauth" ? (input.accountEmail ?? null) : null;
  const existing = await prisma.googleCalendar.findUnique({ where: { id: 1 } });
  if (existing) {
    // "primary" means a different calendar for each account that signs in.
    const sameCalendar =
      existing.calendarId === calendarId &&
      (calendarId !== PRIMARY_CALENDAR || (!!accountEmail && existing.accountEmail === accountEmail));
    if (!sameCalendar) await prisma.session.updateMany({ data: { googleEventId: null, googleSyncError: null } });
  }
  const data = {
    accountEmail,
    refreshToken: creds.kind === "oauth" ? creds.refreshToken : null,
    clientEmail: creds.kind === "service" ? creds.clientEmail : null,
    privateKey: creds.kind === "service" ? creds.privateKey : null,
    calendarId,
    appUrl: input.appUrl,
    lastError: null,
    lastErrorAt: null,
    ...(input.fullNames === undefined ? {} : { fullNames: input.fullNames }),
  };
  await prisma.googleCalendar.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  return syncUpcoming();
}

/**
 * Finishes "Connect Google Calendar". Uses the account's main calendar, or
 * keeps the calendar she picked earlier when the same account signs in again.
 * Throws a GoogleError with a readable message if Google will not let us write.
 */
export async function connectSignedIn(creds: OAuthCreds, accountEmail: string | null, appUrl: string | null) {
  const existing = await prisma.googleCalendar.findUnique({ where: { id: 1 } });
  const sameAccount = !!existing?.refreshToken && !!accountEmail && existing.accountEmail === accountEmail;
  const calendarId = sameAccount ? existing.calendarId : PRIMARY_CALENDAR;
  await testCalendarAccess(creds, calendarId);
  return saveConnection({ creds, accountEmail, calendarId, appUrl });
}

/**
 * Sends sessions to a different calendar from now on. Upcoming events are
 * taken off the old one so nothing shows twice. Throws if the new calendar
 * cannot be written to, leaving everything as it was.
 */
export async function moveToCalendar(calendarId: string): Promise<{ ok: number; failed: number }> {
  const cfg = await getConfig();
  if (!cfg) throw new Error("Google Calendar is not connected.");
  if (calendarId === cfg.calendarId) return syncUpcoming();
  await testCalendarAccess(cfg.creds, calendarId);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const old = await prisma.session.findMany({
    where: { startsAt: { gte: startOfToday }, googleEventId: { not: null } },
    select: { googleEventId: true },
  });
  for (const s of old) {
    // Best effort: a leftover event on the old calendar is not worth failing for.
    await deleteEvent(cfg.creds, cfg.calendarId, s.googleEventId!).catch(() => {});
  }
  await prisma.session.updateMany({ data: { googleEventId: null, googleSyncError: null } });
  await prisma.googleCalendar.updateMany({ where: { id: 1 }, data: { calendarId, lastError: null, lastErrorAt: null } });
  return syncUpcoming();
}

/** For Settings: how the mirror is doing. */
export async function syncStatus() {
  const cfg = await getConfig();
  if (!cfg) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [onCalendar, waiting, failed] = await Promise.all([
    prisma.session.count({ where: { startsAt: { gte: startOfToday }, status: "SCHEDULED", googleEventId: { not: null } } }),
    prisma.session.count({ where: { startsAt: { gte: startOfToday }, status: "SCHEDULED", googleEventId: null } }),
    prisma.session.count({ where: { startsAt: { gte: startOfToday }, googleSyncError: { not: null } } }),
  ]);
  return {
    signedIn: cfg.creds.kind === "oauth",
    // Who the calendar has to be reachable by: the signed-in account, or the service account.
    account: cfg.creds.kind === "oauth" ? cfg.accountEmail : cfg.creds.clientEmail,
    mainCalendar: cfg.calendarId === PRIMARY_CALENDAR,
    calendarId: cfg.calendarId,
    fullNames: cfg.fullNames,
    lastSyncAt: cfg.lastSyncAt,
    lastError: cfg.lastError,
    lastErrorAt: cfg.lastErrorAt,
    onCalendar,
    waiting,
    failed,
  };
}
