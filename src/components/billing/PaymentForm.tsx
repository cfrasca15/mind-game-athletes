import { recordPaymentAction } from "@/lib/actions/payments";
import { Field } from "@/components/ui";
import { dateInputValue, money } from "@/lib/format";
import { PaymentMethodSelect } from "./PaymentMethodSelect";

type PackOption = { id: string; name: string; priceCents: number; purchasedAt: Date };

export function PaymentForm({
  clientId,
  teamId,
  packs = [],
  defaultAmountCents,
}: {
  clientId?: string;
  teamId?: string;
  packs?: PackOption[];
  defaultAmountCents?: number;
}) {
  return (
    <form action={recordPaymentAction} className="grid gap-3 sm:grid-cols-2">
      {clientId && <input type="hidden" name="clientId" value={clientId} />}
      {teamId && <input type="hidden" name="teamId" value={teamId} />}
      <Field label="Amount ($)">
        <input
          name="amount"
          inputMode="decimal"
          required
          defaultValue={defaultAmountCents && defaultAmountCents > 0 ? (defaultAmountCents / 100).toFixed(2) : ""}
          className="input"
        />
      </Field>
      <Field label="Date"><input name="paidAt" type="date" defaultValue={dateInputValue(new Date())} className="input" /></Field>
      <Field label="Method"><PaymentMethodSelect /></Field>
      <Field label="For">
        <select name="clientPackageId" className="input" defaultValue="">
          <option value="">General / single sessions</option>
          {packs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({money(p.priceCents)}, {new Date(p.purchasedAt).toLocaleDateString()})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Note" className="sm:col-span-2"><input name="note" className="input" /></Field>
      <div className="sm:col-span-2"><button className="btn-primary">Record payment</button></div>
    </form>
  );
}
