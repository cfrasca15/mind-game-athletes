import { Field } from "@/components/ui";
import { dateInputValue } from "@/lib/format";
import type { Client, Team } from "@/generated/prisma/client";

export function ClientForm({
  client,
  teams,
  action,
  submitLabel,
}: {
  client?: Client | null;
  teams: Team[];
  action: (fd: FormData) => Promise<void>;
  submitLabel: string;
}) {
  const c = client;
  return (
    <form action={action} className="space-y-6">
      <section className="card space-y-4">
        <h2 className="font-semibold text-stone-900">Player</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name"><input name="firstName" required defaultValue={c?.firstName} className="input" /></Field>
          <Field label="Last name"><input name="lastName" required defaultValue={c?.lastName} className="input" /></Field>
          <Field label="Date of birth"><input name="dateOfBirth" type="date" defaultValue={dateInputValue(c?.dateOfBirth)} className="input" /></Field>
          <Field label="Status">
            <select name="status" defaultValue={c?.status ?? "ACTIVE"} className="input">
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="FORMER">Former</option>
            </select>
          </Field>
          <Field label="Team">
            <select name="teamId" defaultValue={c?.teamId ?? ""} className="input">
              <option value="">— None —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.club ? ` (${t.club})` : ""}</option>
              ))}
            </select>
          </Field>
          <Field label="Position"><input name="position" defaultValue={c?.position ?? ""} className="input" placeholder="Goalkeeper, Midfield…" /></Field>
          <Field label="School"><input name="school" defaultValue={c?.school ?? ""} className="input" /></Field>
          <Field label="Grad year"><input name="gradYear" type="number" min={2000} max={2100} defaultValue={c?.gradYear ?? ""} className="input" /></Field>
          <Field label="Player email"><input name="email" type="email" defaultValue={c?.email ?? ""} className="input" /></Field>
          <Field label="Player phone"><input name="phone" defaultValue={c?.phone ?? ""} className="input" /></Field>
        </div>
      </section>

      {!c && (
        <section className="card space-y-4">
          <h2 className="font-semibold text-stone-900">Parent / guardian</h2>
          <p className="text-sm text-stone-500">Optional here. More can be added from the player page.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input name="guardianName" className="input" /></Field>
            <Field label="Relationship"><input name="guardianRelationship" className="input" placeholder="Mom, Dad…" /></Field>
            <Field label="Phone"><input name="guardianPhone" className="input" /></Field>
            <Field label="Email"><input name="guardianEmail" type="email" className="input" /></Field>
          </div>
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="font-semibold text-stone-900">Intake</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coach name"><input name="coachName" defaultValue={c?.coachName ?? ""} className="input" /></Field>
          <Field label="Referred by"><input name="referredBy" defaultValue={c?.referredBy ?? ""} className="input" /></Field>
          <Field label="Goals at intake" className="sm:col-span-2"><textarea name="goalsAtIntake" defaultValue={c?.goalsAtIntake ?? ""} className="input" /></Field>
          <Field label="Injury history" className="sm:col-span-2"><textarea name="injuryHistory" defaultValue={c?.injuryHistory ?? ""} className="input" /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input name="consentOnFile" type="checkbox" defaultChecked={c?.consentOnFile ?? false} /> Parent consent form on file
          </label>
          <Field label="Consent date"><input name="consentDate" type="date" defaultValue={dateInputValue(c?.consentDate)} className="input" /></Field>
          <Field label="General notes" className="sm:col-span-2"><textarea name="notes" defaultValue={c?.notes ?? ""} className="input" /></Field>
        </div>
      </section>

      <div className="flex gap-2">
        <button className="btn-primary">{submitLabel}</button>
      </div>
    </form>
  );
}
