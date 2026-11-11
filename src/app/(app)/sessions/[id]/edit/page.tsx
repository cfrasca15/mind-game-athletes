import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateSessionAction } from "@/lib/actions/sessions";
import { SessionForm } from "@/components/SessionForm";
import { BackLink, PageHeader } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await prisma.session.findUnique({ where: { id } });
  if (!s) notFound();
  const owner = s.clientId ? { clientId: s.clientId } : { teamId: s.teamId };
  const packs = await prisma.clientPackage.findMany({
    where: { ...owner, status: { in: ["ACTIVE", "EXHAUSTED"] } },
    orderBy: { purchasedAt: "asc" },
    include: { _count: { select: { sessions: { where: { status: "COMPLETED" } } } } },
  });
  return (
    <>
      <BackLink href={`/sessions/${id}`}>{fmtDateTime(s.startsAt)}</BackLink>
      <PageHeader title="Edit session" />
      <SessionForm
        action={updateSessionAction.bind(null, id)}
        submitLabel="Save changes"
        session={s}
        packs={packs.map((p) => ({ id: p.id, name: p.name, sessionCount: p.sessionCount, used: p._count.sessions }))}
      />
    </>
  );
}
