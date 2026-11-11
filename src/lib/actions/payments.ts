"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { date, parseMoney, str } from "@/lib/format";
import type { PaymentMethod } from "@/generated/prisma/enums";

export async function recordPaymentAction(fd: FormData) {
  await requireUser();
  const clientId = str(fd.get("clientId"));
  const teamId = str(fd.get("teamId"));
  const amountCents = parseMoney(fd.get("amount"));
  if (amountCents <= 0) throw new Error("Amount must be greater than zero.");
  await prisma.payment.create({
    data: {
      clientId,
      teamId,
      clientPackageId: str(fd.get("clientPackageId")),
      sessionId: str(fd.get("sessionId")),
      amountCents,
      paidAt: date(fd.get("paidAt")) ?? new Date(),
      method: (str(fd.get("method")) ?? "VENMO") as PaymentMethod,
      note: str(fd.get("note")),
    },
  });
  revalidate(clientId, teamId);
}

export async function deletePaymentAction(id: string) {
  await requireUser();
  const p = await prisma.payment.delete({ where: { id } });
  revalidate(p.clientId, p.teamId);
}

function revalidate(clientId: string | null, teamId: string | null) {
  if (clientId) revalidatePath(`/clients/${clientId}`);
  if (teamId) revalidatePath(`/teams/${teamId}`);
  revalidatePath("/payments");
  revalidatePath("/");
}
