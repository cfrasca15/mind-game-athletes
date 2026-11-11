import { Field } from "@/components/ui";
import type { Team } from "@/generated/prisma/client";

export function TeamForm({
  team,
  action,
  submitLabel,
}: {
  team?: Team | null;
  action: (fd: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const t = team;
  return (
    <form action={action} className="space-y-6">
      <section className="card grid gap-4 sm:grid-cols-2">
        <Field label="Team name"><input name="name" required defaultValue={t?.name} className="input" placeholder="U14 Girls Blue" /></Field>
        <Field label="Club"><input name="club" defaultValue={t?.club ?? ""} className="input" /></Field>
        <Field label="Age group"><input name="ageGroup" defaultValue={t?.ageGroup ?? ""} className="input" placeholder="U14, High school…" /></Field>
        <Field label="Status">
          <select name="status" defaultValue={t?.status ?? "ACTIVE"} className="input">
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="FORMER">Former</option>
          </select>
        </Field>
        <Field label="Coach name"><input name="coachName" defaultValue={t?.coachName ?? ""} className="input" /></Field>
        <Field label="Coach phone"><input name="coachPhone" defaultValue={t?.coachPhone ?? ""} className="input" /></Field>
        <Field label="Coach email"><input name="coachEmail" type="email" defaultValue={t?.coachEmail ?? ""} className="input" /></Field>
        <Field label="Notes" className="sm:col-span-2"><textarea name="notes" defaultValue={t?.notes ?? ""} className="input" /></Field>
      </section>
      <button className="btn-primary">{submitLabel}</button>
    </form>
  );
}
