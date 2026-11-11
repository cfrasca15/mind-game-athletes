import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { allBalances } from "@/lib/billing";
import { deletePaymentAction } from "@/lib/actions/payments";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PageHeader, Stat } from "@/components/ui";
import { PAYMENT_METHOD_LABEL, fmtDate, money } from "@/lib/format";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view = "balances" } = await searchParams;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [balances, recent, month, year] = await Promise.all([
    allBalances(),
    prisma.payment.findMany({
      orderBy: { paidAt: "desc" },
      take: 200,
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        team: { select: { id: true, name: true } },
        clientPackage: { select: { name: true } },
      },
    }),
    prisma.payment.aggregate({ where: { paidAt: { gte: monthStart } }, _sum: { amountCents: true } }),
    prisma.payment.aggregate({ where: { paidAt: { gte: yearStart } }, _sum: { amountCents: true } }),
  ]);
  const unpaid = balances.filter((b) => b.dueCents > 0);
  const credit = balances.filter((b) => b.dueCents < 0);
  const totalDue = unpaid.reduce((s, b) => s + b.dueCents, 0);

  return (
    <>
      <PageHeader title="Payments" subtitle="Record payments from a player's or team's page." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Outstanding" value={money(totalDue)} hint={`${unpaid.length} with a balance`} />
        <Stat label="Collected this month" value={money(month._sum.amountCents ?? 0)} />
        <Stat label="Collected this year" value={money(year._sum.amountCents ?? 0)} />
      </div>

      <div className="mb-4 flex gap-1">
        <Link href="/payments?view=balances" className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === "balances" ? "bg-brand-50 text-brand-800" : "text-stone-600 hover:bg-stone-100"}`}>Balances</Link>
        <Link href="/payments?view=ledger" className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === "ledger" ? "bg-brand-50 text-brand-800" : "text-stone-600 hover:bg-stone-100"}`}>Ledger</Link>
      </div>

      {view === "ledger" ? (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>Date</th><th>Who</th><th>Amount</th><th>Method</th><th>For</th><th></th></tr></thead>
            <tbody>
              {recent.length === 0 && <tr><td colSpan={6} className="text-center text-stone-500">No payments yet.</td></tr>}
              {recent.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.paidAt)}</td>
                  <td>
                    {p.client ? <Link href={`/clients/${p.client.id}`} className="hover:underline">{p.client.firstName} {p.client.lastName}</Link>
                      : p.team ? <Link href={`/teams/${p.team.id}`} className="hover:underline">{p.team.name}</Link> : "—"}
                  </td>
                  <td className="font-medium">{money(p.amountCents)}</td>
                  <td>{PAYMENT_METHOD_LABEL[p.method]}</td>
                  <td className="text-stone-500">{p.clientPackage?.name ?? "—"}{p.note ? ` · ${p.note}` : ""}</td>
                  <td className="text-right"><ConfirmButton className="text-xs text-red-600 hover:underline" action={deletePaymentAction.bind(null, p.id)} message="Delete this payment?">Delete</ConfirmButton></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>Who</th><th>Billed</th><th>Paid</th><th>Due</th></tr></thead>
            <tbody>
              {balances.length === 0 && <tr><td colSpan={4} className="text-center text-stone-500">No billing activity yet.</td></tr>}
              {[...unpaid, ...balances.filter((b) => b.dueCents === 0), ...credit].map((b) => (
                <tr key={b.key}>
                  <td><Link href={b.clientId ? `/clients/${b.clientId}` : `/teams/${b.teamId}`} className="font-medium hover:underline">{b.name}</Link>{b.teamId && <span className="text-stone-500"> (team)</span>}</td>
                  <td>{money(b.owedCents)}</td>
                  <td>{money(b.paidCents)}</td>
                  <td className={b.dueCents > 0 ? "font-medium text-amber-700" : b.dueCents < 0 ? "text-violet-700" : "text-stone-400"}>
                    {b.dueCents < 0 ? `${money(-b.dueCents)} credit` : money(b.dueCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
