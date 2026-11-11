import { createTeamAction } from "@/lib/actions/teams";
import { TeamForm } from "@/components/TeamForm";
import { BackLink, PageHeader } from "@/components/ui";

export default function NewTeamPage() {
  return (
    <>
      <BackLink href="/teams">Teams</BackLink>
      <PageHeader title="New team" />
      <TeamForm action={createTeamAction} submitLabel="Create team" />
    </>
  );
}
