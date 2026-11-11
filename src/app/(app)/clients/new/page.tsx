import { prisma } from "@/lib/prisma";
import { createClientAction } from "@/lib/actions/clients";
import { ClientForm } from "@/components/ClientForm";
import { BackLink, PageHeader } from "@/components/ui";

export default async function NewClientPage() {
  const teams = await prisma.team.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } });
  return (
    <>
      <BackLink href="/clients">Players</BackLink>
      <PageHeader title="New player" />
      <ClientForm teams={teams} action={createClientAction} submitLabel="Create player" />
    </>
  );
}
