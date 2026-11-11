import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  completeSessionAction,
  deleteSessionAction,
  saveSessionNotesAction,
  setSessionStatusAction,
} from "@/lib/actions/sessions";
import { BackLink, Field, PageHeader, Pill } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SESSION_STATUS_LABEL, SESSION_TYPE_LABEL, fmtDateTime, fullName, money } from "@/lib/format";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await prisma.session.findUnique({
    where: { id },
    include: {
      client: { include: { goals: { where: { status: "ACTIVE" } } } },
      team: true,
      clientPackage: { include: { _count: { select: { sessions: { where: { status: "COMPLETED" } } } } } },
    },
  });
  if (!s) notFound();

  const who = s.client ? fullName(s.client) : s.team ? `${s.team.name} (team)` : "—";
  const whoHref = s.client ? `/clients/${s.client.id}` : s.team ? `/teams/${s.team.id}` : "/calendar";

  // Previous completed sessions for context while writing notes.
  const owner = s.clientId ? { clientId: s.clientId } : { teamId: s.teamId };
  const previous = await prisma.session.findMany({
    where: { ...owner, status: "COMPLETED", id: { not: s.id }, startsAt: { lt: s.startsAt } },
    orderBy: { startsAt: "desc" },
    take: 3,
  });

  const isOpen = s.status === "SCHEDULED";

  return (
    <>
      <BackLink href={whoHref}>{who}</BackLink>
      <PageHeader
        title={<span className="flex items-center gap-3">{fmtDateTime(s.startsAt)} <Pill status={s.status} label={SESSION_STATUS_LABEL[s.status]} /></span>}
        subtitle={
          <>
            <Link href={whoHref} className="font-medium text-stone-700 hover:underline">{who}</Link>
            {" · "}{SESSION_TYPE_LABEL[s.type]} · {s.durationMin} min
            {s.location && ` · ${s.location}`}
            {s.title && ` · ${s.title}`}
            {s.clientPackage
              ? ` · ${s.clientPackage.name} (${s.clientPackage._count.sessions} of ${s.clientPackage.sessionCount} used)`
              : s.priceCents != null ? ` · single session ${money(s.priceCents)}` : " · single session"}
          </>
        }
        actions={
          <>
            <Link href={`/sessions/${s.id}/edit`} className="btn">Edit details</Link>
            {s.status !== "SCHEDULED" && (
              <ConfirmButton className="btn" action={setSessionStatusAction.bind(null, s.id, "SCHEDULED")} message="Reopen this session as scheduled?">Reopen</ConfirmButton>
            )}
            <ConfirmButton action={deleteSessionAction.bind(null, s.id)} message="Delete this session?">Delete</ConfirmButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {s.prepNotes && (
            <section className="card">
              <h2 className="mb-2 font-semibold text-stone-900">Plan</h2>
              <p className="whitespace-pre-line text-sm text-stone-700">{s.prepNotes}</p>
            </section>
          )}

          <section className="card">
            <h2 className="mb-3 font-semibold text-stone-900">{isOpen ? "Session notes" : "Notes"}</h2>
            <form action={(isOpen ? completeSessionAction : saveSessionNotesAction).bind(null, s.id)} className="space-y-4">
              <Field label="What happened / what we worked on">
                <textarea name="notes" defaultValue={s.notes ?? ""} className="input min-h-48" placeholder="Observations, exercises, how she responded…" />
              </Field>
              <Field label="Focus for next session">
                <textarea name="nextFocus" defaultValue={s.nextFocus ?? ""} className="input min-h-20" placeholder="Pulled into the plan when you schedule the next one." />
              </Field>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary">{isOpen ? "Save & mark completed" : "Save notes"}</button>
                {isOpen && (
                  <>
                    <ConfirmButton className="btn" action={setSessionStatusAction.bind(null, s.id, "NO_SHOW")} message="Mark as no-show? It will still count against the pack unless you change it.">No-show</ConfirmButton>
                    <ConfirmButton className="btn" action={setSessionStatusAction.bind(null, s.id, "CANCELLED")} message="Cancel this session? It will not count against the pack.">Cancelled</ConfirmButton>
                  </>
                )}
              </div>
              {isOpen && <p className="text-xs text-stone-500">Completing a session uses one from the linked pack. No-shows do not use one; change the status above if her policy is different.</p>}
            </form>
          </section>
        </div>

        <div className="space-y-6">
          {s.client && s.client.goals.length > 0 && (
            <section className="card">
              <h2 className="mb-2 font-semibold text-stone-900">Active goals</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
                {s.client.goals.map((g) => <li key={g.id}>{g.title}</li>)}
              </ul>
            </section>
          )}
          <section className="card">
            <h2 className="mb-2 font-semibold text-stone-900">Previous sessions</h2>
            {previous.length === 0 ? <p className="text-sm text-stone-500">This is the first one.</p> : (
              <ul className="divide-y divide-stone-100">
                {previous.map((p) => (
                  <li key={p.id} className="py-2 text-sm">
                    <Link href={`/sessions/${p.id}`} className="font-medium hover:underline">{fmtDateTime(p.startsAt)}</Link>
                    {p.notes && <p className="mt-1 line-clamp-4 whitespace-pre-line text-stone-600">{p.notes}</p>}
                    {p.nextFocus && <p className="mt-1 text-xs text-emerald-800"><span className="font-medium">Next:</span> {p.nextFocus}</p>}
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
