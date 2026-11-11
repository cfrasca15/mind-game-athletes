"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseServiceAccountKey, testCalendarAccess } from "@/lib/google";
import { syncSession, syncUpcoming } from "@/lib/google-sync";

function summary(r: { ok: number; failed: number }) {
  const sessions = (n: number) => `${n} upcoming session${n === 1 ? "" : "s"}`;
  if (r.failed > 0) return `${sessions(r.ok)} on the calendar, ${r.failed} failed. See the error below.`;
  return r.ok === 0 ? "No upcoming sessions to add yet." : `${sessions(r.ok)} on the calendar.`;
}

/** Save the key and calendar, prove they work, then push what is already booked. */
export async function connectGoogleAction(_prev: string | null, fd: FormData): Promise<string> {
  await requireUser();
  const calendarId = String(fd.get("calendarId") ?? "").trim();
  const rawKey = String(fd.get("key") ?? "").trim();
  if (!calendarId) return "Enter the calendar ID.";
  if (!rawKey) return "Paste the key file.";

  let creds;
  try {
    creds = parseServiceAccountKey(rawKey);
    await testCalendarAccess(creds, calendarId);
  } catch (e) {
    return e instanceof Error ? e.message : "Could not connect to Google.";
  }

  // Where she reaches the CRM, so each event can link back to its session.
  const origin = (await headers()).get("origin");
  const data = {
    clientEmail: creds.clientEmail,
    privateKey: creds.privateKey,
    calendarId,
    fullNames: fd.get("fullNames") === "on",
    appUrl: origin,
    lastError: null,
    lastErrorAt: null,
  };
  const existing = await prisma.googleCalendar.findUnique({ where: { id: 1 } });
  // A different calendar means the old event ids point nowhere useful.
  if (existing && existing.calendarId !== calendarId) {
    await prisma.session.updateMany({ data: { googleEventId: null, googleSyncError: null } });
  }
  await prisma.googleCalendar.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });

  const r = await syncUpcoming();
  revalidatePath("/settings");
  return `Connected. ${summary(r)}`;
}

export async function syncGoogleNowAction(): Promise<string> {
  await requireUser();
  const r = await syncUpcoming();
  revalidatePath("/settings");
  return summary(r);
}

export async function setGoogleNameStyleAction(_prev: string | null, fd: FormData): Promise<string> {
  await requireUser();
  await prisma.googleCalendar.updateMany({ where: { id: 1 }, data: { fullNames: fd.get("fullNames") === "on" } });
  const r = await syncUpcoming();
  revalidatePath("/settings");
  return `Saved. ${summary(r)}`;
}

/** Stops syncing. Events already on Google stay there. */
export async function disconnectGoogleAction() {
  await requireUser();
  await prisma.googleCalendar.deleteMany();
  await prisma.session.updateMany({ data: { googleEventId: null, googleSyncError: null } });
  revalidatePath("/settings");
}

/** Retry one session from its page. */
export async function retryGoogleSyncAction(sessionId: string) {
  await requireUser();
  await syncSession(sessionId);
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/settings");
}
