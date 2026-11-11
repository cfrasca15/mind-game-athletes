import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateClientAction } from "@/lib/actions/clients";
import { ClientForm } from "@/components/ClientForm";
import { BackLink, PageHeader } from "@/components/ui";
import { fullName } from "@/lib/format";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [client, teams] = await Promise.all([
    prisma.client.findUnique({ where: { id } }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!client) notFound();
  const action = updateClientAction.bind(null, id);
  return (
    <>
      <BackLink href={`/clients/${id}`}>{fullName(client)}</BackLink>
      <PageHeader title={`Edit ${fullName(client)}`} />
      <ClientForm client={client} teams={teams} action={action} submitLabel="Save changes" />
    </>
  );
}
