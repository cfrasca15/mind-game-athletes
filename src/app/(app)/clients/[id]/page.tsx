import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { balanceFor } from "@/lib/billing";
import { packagesRemaining } from "@/lib/packages";
import { CLIENT_STATUS_LABEL, age, fmtDate, fullName, money } from "@/lib/format";
import { deleteClientAction } from "@/lib/actions/clients";
import { BackLink, PageHeader, Pill } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SessionList } from "@/components/SessionList";
import { PackList } from "@/components/billing/PackList";
import { PaymentList } from "@/components/billing/PaymentList";
import { PurchaseForm } from "@/components/billing/PurchaseForm";
import { PaymentForm } from "@/components/billing/PaymentForm";
import { GuardianSection } from "./GuardianSection";
import { GoalSection } from "./GoalSection";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      team: true,
      guardians: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      goals: { orderBy: [{ status: "asc" }, { createdAt: "desc" }] },
      clientPackages: {
        orderBy: { purchasedAt: "desc" },
        include: { _count: { select: { sessions: { where: { status: "COMPLETED" } } } }, payments: true },
      },
      sessions: { orderBy: { startsAt: "desc" }, include: { clientPackage: { select: { name: true } } } },
      payments: { orderBy: { paidAt: "desc" }, include: { clientPackage: { select: { name: true } } } },
    },
  });
  if (!client) notFound();

  const [balance, catalog] = await Promise.all([
    balanceFor({ clientId: id }),
    prisma.package.findMany({ where: { active: true, forTeams: false }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const now = new Date();
  const upcoming = client.sessions.filter((s) => s.status === "SCHEDULED" && s.startsAt >= now).reverse();
  const past = client.sessions.filter((s) => !(s.status === "SCHEDULED" && s.startsAt >= now));
  const activePacks = client.clientPackages.filter((p) => p.status === "ACTIVE");
  const remaining = packagesRemaining(activePacks);
  const a = age(client.dateOfBirth);

  return (
    <>
      <BackLink href="/clients">Players</BackLink>
      <PageHeader
        title={<span className="flex items-center gap-3">{fullName(client)} <Pill status={client.status} label={CLIENT_STATUS_LABEL[client.status]} /></span>}
        subtitle={[
          a !== null ? `Age ${a}` : null,
          client.position,
          client.team ? client.team.name : null,
          client.school,
          client.gradYear ? `Class of ${client.gradYear}` : null,
        ].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href={`/sessions/new?clientId=${client.id}`} className="btn-primary">+ Schedule session</Link>
            <Link href={`/clients/${client.id}/edit`} className="btn">Edit</Link>
            <ConfirmButton action={deleteClientAction.bind(null, client.id)} message={`Delete ${fullName(client)} and every session, package and payment attached? This cannot be undone.`}>Delete</ConfirmButton>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Sessions left</div>
          <div className={`mt-1 text-2xl font-semibold ${activePacks.length > 0 && remaining <= 1 ? "text-amber-700" : "text-stone-900"}`}>
            {activePacks.length === 0 ? "—" : remaining}
          </div>
          <div className="mt-1 text-xs text-stone-500">{activePacks.length === 0 ? "No active package" : activePacks.map((p) => p.name).join(", ")}</div>
        </div>
        <div className="card">
          <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Balance due</div>
          <div className={`mt-1 text-2xl font-semibold ${balance.dueCents > 0 ? "text-amber-700" : "text-stone-900"}`}>{money(balance.dueCents)}</div>
          <div className="mt-1 text-xs text-stone-500">{money(balance.paidCents)} paid of {money(balance.owedCents)}</div>
        </div>
        <div className="card">
          <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Next session</div>
          <div className="mt-1 text-2xl font-semibold text-stone-900">{upcoming[0] ? fmtDate(upcoming[0].startsAt) : "—"}</div>
          <div className="mt-1 text-xs text-stone-500">{past.filter((s) => s.status === "COMPLETED").length} completed so far</div>
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
          <GoalSection clientId={client.id} goals={client.goals} />
        </div>

        <div className="space-y-6">
          <GuardianSection clientId={client.id} guardians={client.guardians} />

          <section className="card">
            <h2 className="mb-3 font-semibold text-stone-900">Packages</h2>
            <PackList packs={client.clientPackages} />
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-800">+ Add package</summary>
              <div className="mt-3"><PurchaseForm packages={catalog} clientId={client.id} /></div>
            </details>
          </section>

          <section className="card">
            <h2 className="mb-3 font-semibold text-stone-900">Payments</h2>
            <PaymentList payments={client.payments} />
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-800">+ Record payment</summary>
              <div className="mt-3">
                <PaymentForm clientId={client.id} packs={client.clientPackages.filter((p) => p.status !== "CANCELLED")} defaultAmountCents={balance.dueCents} />
              </div>
            </details>
          </section>

          {(client.coachName || client.referredBy || client.goalsAtIntake || client.injuryHistory || client.notes || client.email || client.phone) && (
            <section className="card space-y-2 text-sm">
              <h2 className="font-semibold text-stone-900">Details</h2>
              {client.phone && <p><span className="text-stone-500">Phone:</span> {client.phone}</p>}
              {client.email && <p><span className="text-stone-500">Email:</span> {client.email}</p>}
              {client.coachName && <p><span className="text-stone-500">Coach:</span> {client.coachName}</p>}
              {client.referredBy && <p><span className="text-stone-500">Referred by:</span> {client.referredBy}</p>}
              <p><span className="text-stone-500">Consent form:</span> {client.consentOnFile ? `On file${client.consentDate ? ` (${fmtDate(client.consentDate)})` : ""}` : "Not on file"}</p>
              {client.goalsAtIntake && <p className="whitespace-pre-line"><span className="text-stone-500">Goals at intake:</span> {client.goalsAtIntake}</p>}
              {client.injuryHistory && <p className="whitespace-pre-line"><span className="text-stone-500">Injury history:</span> {client.injuryHistory}</p>}
              {client.notes && <p className="whitespace-pre-line"><span className="text-stone-500">Notes:</span> {client.notes}</p>}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
