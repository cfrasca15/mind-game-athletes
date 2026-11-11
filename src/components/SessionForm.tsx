import { Field } from "@/components/ui";
import { SESSION_TYPE_LABEL, dateTimeInputValue, money } from "@/lib/format";

type PackOption = { id: string; name: string; sessionCount: number; used: number };
type Person = { id: string; label: string };

export function SessionForm({
  action,
  submitLabel,
  session,
  clientId,
  teamId,
  clients,
  teams,
  packs,
  defaultPrepNotes,
  defaultStart: defaultStartProp,
  returnTo,
}: {
  action: (fd: FormData) => Promise<void>;
  submitLabel: string;
  session?: {
    startsAt: Date;
    durationMin: number;
    type: string;
    location: string | null;
    title: string | null;
    prepNotes: string | null;
    clientPackageId: string | null;
    priceCents: number | null;
  } | null;
  clientId?: string | null;
  teamId?: string | null;
  clients?: Person[];
  teams?: Person[];
  packs: PackOption[];
  defaultPrepNotes?: string | null;
  defaultStart?: Date | null;
  returnTo?: string;
}) {
  const s = session;
  const editing = !!s;
  const defaultStart = s?.startsAt ?? defaultStartProp ?? nextHour();
  return (
    <form action={action} className="space-y-6">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <section className="card grid gap-4 sm:grid-cols-2">
        {!editing && (
          <>
            {clientId ? (
              <input type="hidden" name="clientId" value={clientId} />
            ) : teamId ? (
              <input type="hidden" name="teamId" value={teamId} />
            ) : (
              <>
                <Field label="Player">
                  <select name="clientId" className="input" defaultValue="">
                    <option value="">— pick a player —</option>
                    {clients?.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="…or team">
                  <select name="teamId" className="input" defaultValue="">
                    <option value="">— pick a team —</option>
                    {teams?.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </Field>
              </>
            )}
          </>
        )}
        <Field label="Date & time"><input name="startsAt" type="datetime-local" required defaultValue={dateTimeInputValue(defaultStart)} className="input" /></Field>
        <Field label="Length (minutes)"><input name="durationMin" type="number" min={5} step={5} defaultValue={s?.durationMin ?? 60} className="input" /></Field>
        <Field label="Type">
          <select name="type" defaultValue={s?.type ?? "IN_PERSON"} className="input">
            {Object.entries(SESSION_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Location / link"><input name="location" defaultValue={s?.location ?? ""} className="input" placeholder="Office, Zoom link, field…" /></Field>
        <Field label="Title (optional)" className="sm:col-span-2"><input name="title" defaultValue={s?.title ?? ""} className="input" placeholder="Pre-tournament check-in" /></Field>
        <Field label="Counts against">
          <select name="clientPackageId" className="input" defaultValue={editing ? "keep" : "auto"}>
            {editing && <option value="keep">Keep current</option>}
            <option value="auto">Automatic (oldest active pack)</option>
            {packs.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.used} of {p.sessionCount} used)</option>
            ))}
            <option value="none">Single session (not from a pack)</option>
          </select>
        </Field>
        <Field label="Single-session price ($)">
          <input name="price" inputMode="decimal" defaultValue={s?.priceCents != null ? (s.priceCents / 100).toFixed(2) : ""} className="input" placeholder="Only if not from a pack" />
        </Field>
        <Field label="Plan for this session" className="sm:col-span-2">
          <textarea name="prepNotes" defaultValue={s?.prepNotes ?? defaultPrepNotes ?? ""} className="input" placeholder="What to cover…" />
        </Field>
      </section>
      <button className="btn-primary">{submitLabel}</button>
      {s?.priceCents != null && <span className="ml-3 text-sm text-stone-500">Currently {money(s.priceCents)}</span>}
    </form>
  );
}

function nextHour() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}
