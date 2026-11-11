"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { str } from "@/lib/format";
import type { ClientStatus } from "@/generated/prisma/enums";

function teamData(fd: FormData) {
  return {
    name: String(fd.get("name") ?? "").trim(),
    club: str(fd.get("club")),
    ageGroup: str(fd.get("ageGroup")),
    coachName: str(fd.get("coachName")),
    coachEmail: str(fd.get("coachEmail")),
    coachPhone: str(fd.get("coachPhone")),
    notes: str(fd.get("notes")),
    status: (str(fd.get("status")) ?? "ACTIVE") as ClientStatus,
  };
}

export async function createTeamAction(fd: FormData) {
  await requireUser();
  const data = teamData(fd);
  if (!data.name) throw new Error("Team name is required.");
  const team = await prisma.team.create({ data });
  revalidatePath("/teams");
  redirect(`/teams/${team.id}`);
}

export async function updateTeamAction(id: string, fd: FormData) {
  await requireUser();
  const data = teamData(fd);
  if (!data.name) throw new Error("Team name is required.");
  await prisma.team.update({ where: { id }, data });
  revalidatePath("/teams");
  revalidatePath(`/teams/${id}`);
  redirect(`/teams/${id}`);
}

export async function deleteTeamAction(id: string) {
  await requireUser();
  await prisma.team.delete({ where: { id } });
  revalidatePath("/teams");
  revalidatePath("/clients");
  redirect("/teams");
}
