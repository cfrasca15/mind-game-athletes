import { prisma } from "@/lib/prisma";
import { deleteEvent, insertEvent, updateEvent, GoogleError, type GoogleCreds, type GoogleEvent } from "@/lib/google";
import { SESSION_TYPE_LABEL } from "@/lib/format";

/**
 * One-way mirror of sessions onto a Google Calendar. The CRM is the source of
 * truth: nothing is ever read back from Google.
 *
 * Nothing in here throws. A Google outage must never stop her saving a
 * session, so failures are recorded on the session and shown in Settings.
 */

type Config = NonNullable<Awaited<ReturnType<typeof getConfig>>>;

function getConfig() {
  return prisma.googleCalendar.findUnique({ where: { id: 1 } });
}

const creds = (c: Config): GoogleCreds => ({ clientEmail: c.clientEmail, privateKey: c.privateKey });

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
      if (eventId) await deleteEvent(creds(cfg), cfg.calendarId, eventId);
      eventId = null;
    } else {
      const event = eventFor(cfg, s);
      if (eventId) {
        try {
          await updateEvent(creds(cfg), cfg.calendarId, eventId, event);
        } catch (e) {
          // Event was removed on the Google side: put it back.
          if (!(e instanceof GoogleError && e.notFound)) throw e;
          eventId = await insertEvent(creds(cfg), cfg.calendarId, event);
        }
      } else {
        eventId = await insertEvent(creds(cfg), cfg.calendarId, event);
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
        await deleteEvent(creds(cfg), cfg.calendarId, id);
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
    clientEmail: cfg.clientEmail,
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
