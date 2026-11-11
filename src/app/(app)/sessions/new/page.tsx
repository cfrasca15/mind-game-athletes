import { prisma } from "@/lib/prisma";
import { createSessionAction } from "@/lib/actions/sessions";
import { SessionForm } from "@/components/SessionForm";
import { BackLink, PageHeader } from "@/components/ui";
import { fullName } from "@/lib/format";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; teamId?: string; date?: string }>;
}) {
  const { clientId, teamId, date } = await searchParams;
  // From the calendar's "+" on a day: default to 4pm that day.
  const defaultStart = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T16:00:00`) : null;

  const client = clientId ? await prisma.client.findUnique({ where: { id: clientId } }) : null;
  const team = !client && teamId ? await prisma.team.findUnique({ where: { id: teamId } }) : null;

  const owner = client ? { clientId: client.id } : team ? { teamId: team.id } : null;
  const packs = owner
    ? await prisma.clientPackage.findMany({
        where: { ...owner, status: "ACTIVE" },
        orderBy: { purchasedAt: "asc" },
        include: { _count: { select: { sessions: { where: { status: "COMPLETED" } } } } },
      })
    : [];
  // Pull forward the "next time" note from the last completed session.
  const last = owner
    ? await prisma.session.findFirst({ where: { ...owner, status: "COMPLETED" }, orderBy: { startsAt: "desc" } })
    : null;

  const [clients, teams] = owner
    ? [[], []]
    : await Promise.all([
        prisma.client.findMany({ where: { status: "ACTIVE" }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
        prisma.team.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
      ]);

  const back = client ? `/clients/${client.id}` : team ? `/teams/${team.id}` : "/calendar";
  const who = client ? fullName(client) : team ? `${team.name} (team)` : null;

  return (
    <>
      <BackLink href={back}>{who ?? "Calendar"}</BackLink>
      <PageHeader title={who ? `Schedule session · ${who}` : "Schedule session"} />
      <SessionForm
        action={createSessionAction}
        submitLabel="Schedule"
        clientId={client?.id}
        teamId={team?.id}
        clients={clients.map((c) => ({ id: c.id, label: `${c.lastName}, ${c.firstName}` }))}
        teams={teams.map((t) => ({ id: t.id, label: t.name }))}
        packs={packs.map((p) => ({ id: p.id, name: p.name, sessionCount: p.sessionCount, used: p._count.sessions }))}
        defaultPrepNotes={last?.nextFocus}
        defaultStart={defaultStart}
        returnTo={owner ? back : undefined}
      />
    </>
  );
}
