"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { date, int, parseMoney, str } from "@/lib/format";
import { refreshPackageStatus } from "@/lib/packages";
import type { PaymentMethod } from "@/generated/prisma/enums";

// Catalog

export async function savePackageAction(fd: FormData) {
  await requireUser();
  const id = str(fd.get("id"));
  const data = {
    name: String(fd.get("name") ?? "").trim(),
    sessionCount: int(fd.get("sessionCount")) ?? 1,
    priceCents: parseMoney(fd.get("price")),
    expiresDays: int(fd.get("expiresDays")),
    forTeams: fd.get("forTeams") === "on",
    active: fd.get("active") !== "off",
    sortOrder: int(fd.get("sortOrder")) ?? 0,
  };
  if (!data.name) throw new Error("Package name is required.");
  if (id) await prisma.package.update({ where: { id }, data });
  else await prisma.package.create({ data });
  revalidatePath("/settings");
}

export async function togglePackageActiveAction(id: string, active: boolean) {
  await requireUser();
  await prisma.package.update({ where: { id }, data: { active } });
  revalidatePath("/settings");
}

export async function deletePackageAction(id: string) {
  await requireUser();
  const used = await prisma.clientPackage.count({ where: { packageId: id } });
  if (used > 0) {
    // Keep history intact; just hide it from the catalog.
    await prisma.package.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.package.delete({ where: { id } });
  }
  revalidatePath("/settings");
}

// Purchases

export async function purchasePackageAction(fd: FormData) {
  await requireUser();
  const clientId = str(fd.get("clientId"));
  const teamId = str(fd.get("teamId"));
  const packageId = String(fd.get("packageId"));
  const pkg = await prisma.package.findUniqueOrThrow({ where: { id: packageId } });
  const purchasedAt = date(fd.get("purchasedAt")) ?? new Date();
  const priceOverride = str(fd.get("price"));
  const priceCents = priceOverride ? parseMoney(priceOverride) : pkg.priceCents;
  const expiresAt = pkg.expiresDays
    ? new Date(purchasedAt.getTime() + pkg.expiresDays * 86_400_000)
    : null;

  const pack = await prisma.clientPackage.create({
    data: {
      clientId,
      teamId,
      packageId,
      name: pkg.name,
      sessionCount: pkg.sessionCount,
      priceCents,
      purchasedAt,
      expiresAt,
      notes: str(fd.get("notes")),
    },
  });

  // Optional payment recorded at the same time.
  const paidNow = str(fd.get("paidNow"));
  if (paidNow) {
    await prisma.payment.create({
      data: {
        clientId,
        teamId,
        clientPackageId: pack.id,
        amountCents: parseMoney(paidNow),
        paidAt: purchasedAt,
        method: (str(fd.get("method")) ?? "VENMO") as PaymentMethod,
        note: "Paid with purchase",
      },
    });
  }
  revalidate(clientId, teamId);
}

export async function cancelClientPackageAction(id: string) {
  await requireUser();
  const pack = await prisma.clientPackage.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidate(pack.clientId, pack.teamId);
}

export async function reactivateClientPackageAction(id: string) {
  await requireUser();
  const pack = await prisma.clientPackage.update({ where: { id }, data: { status: "ACTIVE" } });
  await refreshPackageStatus(id);
  revalidate(pack.clientId, pack.teamId);
}

export async function deleteClientPackageAction(id: string) {
  await requireUser();
  const pack = await prisma.clientPackage.delete({ where: { id } });
  revalidate(pack.clientId, pack.teamId);
}

function revalidate(clientId: string | null, teamId: string | null) {
  if (clientId) revalidatePath(`/clients/${clientId}`);
  if (teamId) revalidatePath(`/teams/${teamId}`);
  revalidatePath("/clients");
  revalidatePath("/payments");
  revalidatePath("/");
}
