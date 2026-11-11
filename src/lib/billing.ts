import { prisma } from "@/lib/prisma";

export type Balance = { owedCents: number; paidCents: number; dueCents: number };

/**
 * What a client (or team) owes: every non-cancelled pack's price plus every
 * completed single session's price, minus payments recorded.
 */
export async function balanceFor(opts: { clientId?: string; teamId?: string }): Promise<Balance> {
  const owner = opts.clientId ? { clientId: opts.clientId } : { teamId: opts.teamId };
  const [packs, singles, payments] = await Promise.all([
    prisma.clientPackage.aggregate({
      where: { ...owner, status: { not: "CANCELLED" } },
      _sum: { priceCents: true },
    }),
    prisma.session.aggregate({
      where: { ...owner, clientPackageId: null, status: "COMPLETED" },
      _sum: { priceCents: true },
    }),
    prisma.payment.aggregate({ where: owner, _sum: { amountCents: true } }),
  ]);
  const owedCents = (packs._sum.priceCents ?? 0) + (singles._sum.priceCents ?? 0);
  const paidCents = payments._sum.amountCents ?? 0;
  return { owedCents, paidCents, dueCents: owedCents - paidCents };
}

/** Balances for everyone with any billing activity, for the payments page and dashboard. */
export async function allBalances() {
  const [packs, singles, payments, clients, teams] = await Promise.all([
    prisma.clientPackage.groupBy({
      by: ["clientId", "teamId"],
      where: { status: { not: "CANCELLED" } },
      _sum: { priceCents: true },
    }),
    prisma.session.groupBy({
      by: ["clientId", "teamId"],
      where: { clientPackageId: null, status: "COMPLETED", priceCents: { not: null } },
      _sum: { priceCents: true },
    }),
    prisma.payment.groupBy({ by: ["clientId", "teamId"], _sum: { amountCents: true } }),
    prisma.client.findMany({ select: { id: true, firstName: true, lastName: true } }),
    prisma.team.findMany({ select: { id: true, name: true } }),
  ]);

  const map = new Map<string, Balance & { key: string; clientId: string | null; teamId: string | null; name: string }>();
  const key = (c: string | null, t: string | null) => (c ? `c:${c}` : `t:${t}`);
  const ensure = (c: string | null, t: string | null) => {
    const k = key(c, t);
    let row = map.get(k);
    if (!row) {
      const name = c
        ? (() => {
            const cl = clients.find((x) => x.id === c);
            return cl ? `${cl.firstName} ${cl.lastName}` : "Unknown";
          })()
        : (teams.find((x) => x.id === t)?.name ?? "Unknown team");
      row = { key: k, clientId: c, teamId: t, name, owedCents: 0, paidCents: 0, dueCents: 0 };
      map.set(k, row);
    }
    return row;
  };
  for (const p of packs) ensure(p.clientId, p.teamId).owedCents += p._sum.priceCents ?? 0;
  for (const s of singles) ensure(s.clientId, s.teamId).owedCents += s._sum.priceCents ?? 0;
  for (const p of payments) ensure(p.clientId, p.teamId).paidCents += p._sum.amountCents ?? 0;
  for (const row of map.values()) row.dueCents = row.owedCents - row.paidCents;
  return [...map.values()].sort((a, b) => b.dueCents - a.dueCents);
}
