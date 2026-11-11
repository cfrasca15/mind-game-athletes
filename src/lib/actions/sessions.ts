"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { date, int, parseMoney, str } from "@/lib/format";
import { defaultPackageFor, refreshPackageStatus } from "@/lib/packages";
import { removeEvents, syncSession } from "@/lib/google-sync";
import type { SessionStatus, SessionType } from "@/generated/prisma/enums";

async function resolvePackage(fd: FormData, clientId: string | null, teamId: string | null) {
  const choice = str(fd.get("clientPackageId")) ?? "auto";
  if (choice === "none") return null;
  if (choice === "auto") return (await defaultPackageFor({ clientId, teamId }))?.id ?? null;
  return choice;
}

export async function createSessionAction(fd: FormData) {
  await requireUser();
  const clientId = str(fd.get("clientId"));
  const teamId = clientId ? null : str(fd.get("teamId"));
  if (!clientId && !teamId) throw new Error("Pick a player or a team.");
  const startsAt = date(fd.get("startsAt"));
  if (!startsAt) throw new Error("Date and time are required.");
  const clientPackageId = await resolvePackage(fd, clientId, teamId);
  const priceStr = str(fd.get("price"));

  const session = await prisma.session.create({
    data: {
      clientId,
      teamId,
      clientPackageId,
      startsAt,
      durationMin: int(fd.get("durationMin")) ?? 60,
      type: (str(fd.get("type")) ?? "IN_PERSON") as SessionType,
      location: str(fd.get("location")),
      title: str(fd.get("title")),
      prepNotes: str(fd.get("prepNotes")),
      priceCents: clientPackageId ? null : priceStr ? parseMoney(priceStr) : null,
    },
  });
  await syncSession(session.id);
  revalidate(clientId, teamId);
  redirect(str(fd.get("returnTo")) ?? `/sessions/${session.id}`);
}

export async function updateSessionAction(id: string, fd: FormData) {
  await requireUser();
  const existing = await prisma.session.findUniqueOrThrow({ where: { id } });
  const startsAt = date(fd.get("startsAt"));
  if (!startsAt) throw new Error("Date and time are required.");
  const choice = str(fd.get("clientPackageId")) ?? "keep";
  const clientPackageId =
    choice === "keep" ? existing.clientPackageId : await resolvePackage(fd, existing.clientId, existing.teamId);
  const priceStr = str(fd.get("price"));

  await prisma.session.update({
    where: { id },
    data: {
      startsAt,
      durationMin: int(fd.get("durationMin")) ?? 60,
      type: (str(fd.get("type")) ?? "IN_PERSON") as SessionType,
      location: str(fd.get("location")),
      title: str(fd.get("title")),
      prepNotes: str(fd.get("prepNotes")),
      clientPackageId,
      priceCents: clientPackageId ? null : priceStr ? parseMoney(priceStr) : null,
    },
  });
  if (existing.clientPackageId) await refreshPackageStatus(existing.clientPackageId);
  if (clientPackageId) await refreshPackageStatus(clientPackageId);
  await syncSession(id);
  revalidate(existing.clientId, existing.teamId);
  redirect(`/sessions/${id}`);
}

/** Save post-session notes and mark the session completed. */
export async function completeSessionAction(id: string, fd: FormData) {
  await requireUser();
  const s = await prisma.session.update({
    where: { id },
    data: {
      status: "COMPLETED",
      notes: str(fd.get("notes")),
      nextFocus: str(fd.get("nextFocus")),
    },
  });
  if (s.clientPackageId) await refreshPackageStatus(s.clientPackageId);
  revalidate(s.clientId, s.teamId);
  revalidatePath(`/sessions/${id}`);
}

/** Save notes without changing status (e.g. editing a completed session). */
export async function saveSessionNotesAction(id: string, fd: FormData) {
  await requireUser();
  const s = await prisma.session.update({
    where: { id },
    data: { notes: str(fd.get("notes")), nextFocus: str(fd.get("nextFocus")) },
  });
  revalidate(s.clientId, s.teamId);
  revalidatePath(`/sessions/${id}`);
}

export async function setSessionStatusAction(id: string, status: SessionStatus) {
  await requireUser();
  const s = await prisma.session.update({ where: { id }, data: { status } });
  await syncSession(id);
  if (s.clientPackageId) await refreshPackageStatus(s.clientPackageId);
  revalidate(s.clientId, s.teamId);
  revalidatePath(`/sessions/${id}`);
}

export async function deleteSessionAction(id: string) {
  await requireUser();
  const s = await prisma.session.delete({ where: { id } });
  await removeEvents([s.googleEventId]);
  if (s.clientPackageId) await refreshPackageStatus(s.clientPackageId);
  revalidate(s.clientId, s.teamId);
  redirect(s.clientId ? `/clients/${s.clientId}` : s.teamId ? `/teams/${s.teamId}` : "/calendar");
}

function revalidate(clientId: string | null, teamId: string | null) {
  if (clientId) revalidatePath(`/clients/${clientId}`);
  if (teamId) revalidatePath(`/teams/${teamId}`);
  revalidatePath("/clients");
  revalidatePath("/calendar");
  revalidatePath("/payments");
  revalidatePath("/");
}
