import { prisma } from "@/lib/prisma";

type PackWithCount = { sessionCount: number; _count: { sessions: number } };

/** Sessions left across a set of active packs. */
export function packagesRemaining(packs: PackWithCount[]) {
  return packs.reduce((sum, p) => sum + Math.max(0, p.sessionCount - p._count.sessions), 0);
}

/**
 * Recompute a pack's status from its completed sessions and expiry.
 * Called after any session or pack change that could affect it.
 */
export async function refreshPackageStatus(clientPackageId: string) {
  const pack = await prisma.clientPackage.findUnique({
    where: { id: clientPackageId },
    include: { _count: { select: { sessions: { where: { status: "COMPLETED" } } } } },
  });
  if (!pack || pack.status === "CANCELLED") return;
  let status: "ACTIVE" | "EXHAUSTED" | "EXPIRED" = "ACTIVE";
  if (pack._count.sessions >= pack.sessionCount) status = "EXHAUSTED";
  else if (pack.expiresAt && pack.expiresAt < new Date()) status = "EXPIRED";
  if (status !== pack.status) {
    await prisma.clientPackage.update({ where: { id: clientPackageId }, data: { status } });
  }
}

/** The pack a new session for this client/team should draw from, if any. */
export async function defaultPackageFor(opts: { clientId?: string | null; teamId?: string | null }) {
  if (!opts.clientId && !opts.teamId) return null;
  const packs = await prisma.clientPackage.findMany({
    where: {
      status: "ACTIVE",
      ...(opts.clientId ? { clientId: opts.clientId } : { teamId: opts.teamId }),
    },
    orderBy: { purchasedAt: "asc" },
    include: { _count: { select: { sessions: { where: { status: "COMPLETED" } } } } },
  });
  return packs.find((p) => p.sessionCount - p._count.sessions > 0) ?? null;
}

export function sessionsUsed(p: { _count: { sessions: number } }) {
  return p._count.sessions;
}
