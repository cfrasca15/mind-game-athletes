"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { date, int, str } from "@/lib/format";
import type { ClientStatus, GoalStatus } from "@/generated/prisma/enums";

function clientData(fd: FormData) {
  return {
    firstName: String(fd.get("firstName") ?? "").trim(),
    lastName: String(fd.get("lastName") ?? "").trim(),
    email: str(fd.get("email")),
    phone: str(fd.get("phone")),
    dateOfBirth: date(fd.get("dateOfBirth")),
    position: str(fd.get("position")),
    school: str(fd.get("school")),
    gradYear: int(fd.get("gradYear")),
    status: (str(fd.get("status")) ?? "ACTIVE") as ClientStatus,
    teamId: str(fd.get("teamId")),
    coachName: str(fd.get("coachName")),
    injuryHistory: str(fd.get("injuryHistory")),
    referredBy: str(fd.get("referredBy")),
    goalsAtIntake: str(fd.get("goalsAtIntake")),
    consentOnFile: fd.get("consentOnFile") === "on",
    consentDate: date(fd.get("consentDate")),
    notes: str(fd.get("notes")),
  };
}

export async function createClientAction(fd: FormData) {
  await requireUser();
  const data = clientData(fd);
  if (!data.firstName || !data.lastName) throw new Error("First and last name are required.");
  const guardianName = str(fd.get("guardianName"));
  const client = await prisma.client.create({
    data: {
      ...data,
      guardians: guardianName
        ? {
            create: {
              name: guardianName,
              relationship: str(fd.get("guardianRelationship")),
              phone: str(fd.get("guardianPhone")),
              email: str(fd.get("guardianEmail")),
            },
          }
        : undefined,
    },
  });
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClientAction(id: string, fd: FormData) {
  await requireUser();
  const data = clientData(fd);
  if (!data.firstName || !data.lastName) throw new Error("First and last name are required.");
  await prisma.client.update({ where: { id }, data });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function deleteClientAction(id: string) {
  await requireUser();
  await prisma.client.delete({ where: { id } });
  revalidatePath("/clients");
  redirect("/clients");
}

export async function setClientStatusAction(id: string, status: ClientStatus) {
  await requireUser();
  await prisma.client.update({ where: { id }, data: { status } });
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
}

// Guardians

export async function saveGuardianAction(fd: FormData) {
  await requireUser();
  const id = str(fd.get("id"));
  const clientId = String(fd.get("clientId"));
  const data = {
    name: String(fd.get("name") ?? "").trim(),
    relationship: str(fd.get("relationship")),
    phone: str(fd.get("phone")),
    email: str(fd.get("email")),
    isPrimary: fd.get("isPrimary") === "on",
    billingContact: fd.get("billingContact") === "on",
  };
  if (!data.name) throw new Error("Name is required.");
  if (id) await prisma.guardian.update({ where: { id }, data });
  else await prisma.guardian.create({ data: { ...data, clientId } });
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteGuardianAction(id: string, clientId: string) {
  await requireUser();
  await prisma.guardian.delete({ where: { id } });
  revalidatePath(`/clients/${clientId}`);
}

// Goals

export async function saveGoalAction(fd: FormData) {
  await requireUser();
  const id = str(fd.get("id"));
  const clientId = String(fd.get("clientId"));
  const data = {
    title: String(fd.get("title") ?? "").trim(),
    detail: str(fd.get("detail")),
  };
  if (!data.title) throw new Error("Goal title is required.");
  if (id) await prisma.goal.update({ where: { id }, data });
  else await prisma.goal.create({ data: { ...data, clientId } });
  revalidatePath(`/clients/${clientId}`);
}

export async function setGoalStatusAction(id: string, clientId: string, status: GoalStatus) {
  await requireUser();
  await prisma.goal.update({ where: { id }, data: { status } });
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteGoalAction(id: string, clientId: string) {
  await requireUser();
  await prisma.goal.delete({ where: { id } });
  revalidatePath(`/clients/${clientId}`);
}
