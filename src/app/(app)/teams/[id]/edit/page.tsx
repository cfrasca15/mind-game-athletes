import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateTeamAction } from "@/lib/actions/teams";
import { TeamForm } from "@/components/TeamForm";
import { BackLink, PageHeader } from "@/components/ui";

export default async function EditTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) notFound();
  return (
    <>
      <BackLink href={`/teams/${id}`}>{team.name}</BackLink>
      <PageHeader title={`Edit ${team.name}`} />
      <TeamForm team={team} action={updateTeamAction.bind(null, id)} submitLabel="Save changes" />
    </>
  );
}
