import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { balanceFor } from "@/lib/billing";
import { CLIENT_STATUS_LABEL, fmtDate, money } from "@/lib/format";
import { deleteTeamAction } from "@/lib/actions/teams";
import { BackLink, PageHeader, Pill } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SessionList } from "@/components/SessionList";
import { PackList } from "@/components/billing/PackList";
import { PaymentList } from "@/components/billing/PaymentList";
import { PurchaseForm } from "@/components/billing/PurchaseForm";
import { PaymentForm } from "@/components/billing/PaymentForm";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      clients: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] },
      clientPackages: {
        orderBy: { purchasedAt: "desc" },
        include: { _count: { select: { sessions: { where: { status: "COMPLETED" } } } }, payments: true },
      },
      sessions: { orderBy: { startsAt: "desc" }, include: { clientPackage: { select: { name: true } } } },
      payments: { orderBy: { paidAt: "desc" }, include: { clientPackage: { select: { name: true } } } },
    },
  });
  if (!team) notFound();
  const [balance, catalog] = await Promise.all([
    balanceFor({ teamId: id }),
    prisma.package.findMany({ where: { active: true }, orderBy: [{ forTeams: "desc" }, { sortOrder: "asc" }] }),
  ]);
  const now = new Date();
  const upcoming = team.sessions.filter((s) => s.status === "SCHEDULED" && s.startsAt >= now).reverse();
  const past = team.sessions.filter((s) => !(s.status === "SCHEDULED" && s.startsAt >= now));

  return (
    <>
      <BackLink href="/teams">Teams</BackLink>
      <PageHeader
        title={<span className="flex items-center gap-3">{team.name} <Pill status={team.status} label={CLIENT_STATUS_LABEL[team.status]} /></span>}
        subtitle={[team.club, team.ageGroup, team.coachName ? `Coach ${team.coachName}` : null].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href={`/sessions/new?teamId=${team.id}`} className="btn-primary">+ Team session</Link>
            <Link href={`/teams/${team.id}/edit`} className="btn">Edit</Link>
            <ConfirmButton action={deleteTeamAction.bind(null, team.id)} message={`Delete ${team.name}? Players stay but lose the team link; team sessions and payments are deleted.`}>Delete</ConfirmButton>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Balance due</div>
          <div className={`mt-1 text-2xl font-semibold ${balance.dueCents > 0 ? "text-amber-700" : "text-stone-900"}`}>{money(balance.dueCents)}</div>
          <div className="mt-1 text-xs text-stone-500">{money(balance.paidCents)} paid of {money(balance.owedCents)}</div>
        </div>
        <div className="card">
          <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Next session</div>
          <div className="mt-1 text-2xl font-semibold text-stone-900">{upcoming[0] ? fmtDate(upcoming[0].startsAt) : "—"}</div>
        </div>
        <div className="card text-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Coach</div>
          <div className="mt-1 font-medium text-stone-900">{team.coachName ?? "—"}</div>
          {team.coachPhone && <div><a href={`tel:${team.coachPhone}`} className="hover:underline">{team.coachPhone}</a></div>}
          {team.coachEmail && <div><a href={`mailto:${team.coachEmail}`} className="hover:underline">{team.coachEmail}</a></div>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="mb-3 font-semibold text-stone-900">Upcoming</h2>
            <SessionList sessions={upcoming} />
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold text-stone-900">Session history</h2>
            <SessionList sessions={past} />
          </section>
          {team.notes && <section className="card text-sm whitespace-pre-line"><h2 className="mb-2 font-semibold text-stone-900">Notes</h2>{team.notes}</section>}
        </div>
        <div className="space-y-6">
          <section className="card">
            <h2 className="mb-3 font-semibold text-stone-900">Players on this team</h2>
            {team.clients.length === 0 ? <p className="text-sm text-stone-500">None yet. Assign players from their edit page.</p> : (
              <ul className="space-y-1 text-sm">
                {team.clients.map((c) => (
                  <li key={c.id}><Link href={`/clients/${c.id}`} className="hover:underline">{c.firstName} {c.lastName}</Link>{c.position && <span className="text-stone-500"> · {c.position}</span>}</li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold text-stone-900">Packages</h2>
            <PackList packs={team.clientPackages} />
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-800">+ Add package</summary>
              <div className="mt-3"><PurchaseForm packages={catalog} teamId={team.id} /></div>
            </details>
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold text-stone-900">Payments</h2>
            <PaymentList payments={team.payments} />
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-800">+ Record payment</summary>
              <div className="mt-3"><PaymentForm teamId={team.id} packs={team.clientPackages.filter((p) => p.status !== "CANCELLED")} defaultAmountCents={balance.dueCents} /></div>
            </details>
          </section>
        </div>
      </div>
    </>
  );
}
