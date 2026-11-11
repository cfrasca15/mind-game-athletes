import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { allBalances } from "@/lib/billing";
import { packagesRemaining } from "@/lib/packages";
import { PageHeader, Stat } from "@/components/ui";
import { SessionList } from "@/components/SessionList";
import { money } from "@/lib/format";

export default async function DashboardPage() {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday); endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfWeek = new Date(startOfToday); endOfWeek.setDate(endOfWeek.getDate() + 7);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const sessionInclude = {
    client: { select: { id: true, firstName: true, lastName: true } },
    team: { select: { id: true, name: true } },
    clientPackage: { select: { name: true } },
  };

  const [today, week, overdue, activeClients, balances, lowPacks, quiet, monthPayments] = await Promise.all([
    prisma.session.findMany({ where: { status: "SCHEDULED", startsAt: { gte: startOfToday, lt: endOfToday } }, orderBy: { startsAt: "asc" }, include: sessionInclude }),
    prisma.session.findMany({ where: { status: "SCHEDULED", startsAt: { gte: endOfToday, lt: endOfWeek } }, orderBy: { startsAt: "asc" }, include: sessionInclude }),
    prisma.session.findMany({ where: { status: "SCHEDULED", startsAt: { lt: startOfToday } }, orderBy: { startsAt: "desc" }, include: sessionInclude }),
    prisma.client.count({ where: { status: "ACTIVE" } }),
    allBalances(),
    prisma.client.findMany({
      where: { status: "ACTIVE", clientPackages: { some: { status: "ACTIVE" } } },
      include: { clientPackages: { where: { status: "ACTIVE" }, include: { _count: { select: { sessions: { where: { status: "COMPLETED" } } } } } } },
    }),
    prisma.client.findMany({
      where: { status: "ACTIVE", sessions: { none: { startsAt: { gte: thirtyDaysAgo } } } },
      orderBy: { lastName: "asc" },
      include: { sessions: { orderBy: { startsAt: "desc" }, take: 1 } },
    }),
    prisma.payment.aggregate({ where: { paidAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } }, _sum: { amountCents: true } }),
  ]);

  const unpaid = balances.filter((b) => b.dueCents > 0);
  const totalDue = unpaid.reduce((s, b) => s + b.dueCents, 0);
  const runningLow = lowPacks
    .map((c) => ({ c, left: packagesRemaining(c.clientPackages) }))
    .filter((x) => x.left <= 1)
    .sort((a, b) => a.left - b.left);

  return (
    <>
      <PageHeader
        title={greeting()}
        subtitle={now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        actions={<Link href="/sessions/new" className="btn-primary">+ Schedule session</Link>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Today" value={today.length} hint={`${week.length} more this week`} />
        <Stat label="Active players" value={activeClients} />
        <Stat label="Outstanding" value={money(totalDue)} hint={`${unpaid.length} with a balance`} />
        <Stat label="Collected this month" value={money(monthPayments._sum.amountCents ?? 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="mb-3 font-semibold text-stone-900">Today</h2>
            {today.length === 0 ? <p className="text-sm text-stone-500">Nothing scheduled today.</p> : <SessionList sessions={today} showWho />}
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold text-stone-900">Rest of the week</h2>
            {week.length === 0 ? <p className="text-sm text-stone-500">Nothing else this week.</p> : <SessionList sessions={week} showWho />}
          </section>
          {overdue.length > 0 && (
            <section className="card border-amber-200">
              <h2 className="mb-1 font-semibold text-amber-800">Needs wrap-up</h2>
              <p className="mb-3 text-sm text-stone-500">Past sessions still marked scheduled. Open each to add notes and mark it completed.</p>
              <SessionList sessions={overdue} showWho />
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="card">
            <h2 className="mb-3 font-semibold text-stone-900">Running low</h2>
            {runningLow.length === 0 ? <p className="text-sm text-stone-500">Everyone has sessions left.</p> : (
              <ul className="space-y-1 text-sm">
                {runningLow.map(({ c, left }) => (
                  <li key={c.id} className="flex justify-between">
                    <Link href={`/clients/${c.id}`} className="hover:underline">{c.firstName} {c.lastName}</Link>
                    <span className={left === 0 ? "font-medium text-red-700" : "text-amber-700"}>{left} left</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold text-stone-900">Balances due</h2>
            {unpaid.length === 0 ? <p className="text-sm text-stone-500">All paid up.</p> : (
              <ul className="space-y-1 text-sm">
                {unpaid.slice(0, 8).map((b) => (
                  <li key={b.key} className="flex justify-between">
                    <Link href={b.clientId ? `/clients/${b.clientId}` : `/teams/${b.teamId}`} className="hover:underline">{b.name}</Link>
                    <span className="font-medium text-amber-700">{money(b.dueCents)}</span>
                  </li>
                ))}
                {unpaid.length > 8 && <li><Link href="/payments" className="text-xs text-stone-500 hover:underline">See all…</Link></li>}
              </ul>
            )}
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold text-stone-900">Haven&apos;t seen lately</h2>
            <p className="mb-2 text-xs text-stone-500">Active players with no session in 30 days.</p>
            {quiet.length === 0 ? <p className="text-sm text-stone-500">Nobody.</p> : (
              <ul className="space-y-1 text-sm">
                {quiet.slice(0, 8).map((c) => (
                  <li key={c.id} className="flex justify-between">
                    <Link href={`/clients/${c.id}`} className="hover:underline">{c.firstName} {c.lastName}</Link>
                    <span className="text-stone-500">{c.sessions[0] ? new Date(c.sessions[0].startsAt).toLocaleDateString() : "never"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
