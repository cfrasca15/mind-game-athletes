import { purchasePackageAction } from "@/lib/actions/packages";
import { Field } from "@/components/ui";
import { dateInputValue, money } from "@/lib/format";
import type { Package } from "@/generated/prisma/client";
import { PaymentMethodSelect } from "./PaymentMethodSelect";

export function PurchaseForm({
  packages,
  clientId,
  teamId,
}: {
  packages: Package[];
  clientId?: string;
  teamId?: string;
}) {
  if (packages.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        No packages in the catalog yet. Add them under Settings.
      </p>
    );
  }
  return (
    <form action={purchasePackageAction} className="grid gap-3 sm:grid-cols-2">
      {clientId && <input type="hidden" name="clientId" value={clientId} />}
      {teamId && <input type="hidden" name="teamId" value={teamId} />}
      <Field label="Package" className="sm:col-span-2">
        <select name="packageId" className="input" required>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.sessionCount} session{p.sessionCount === 1 ? "" : "s"} · {money(p.priceCents)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Purchase date"><input name="purchasedAt" type="date" defaultValue={dateInputValue(new Date())} className="input" /></Field>
      <Field label="Price override ($)"><input name="price" inputMode="decimal" placeholder="Leave blank for list price" className="input" /></Field>
      <Field label="Paid now ($)"><input name="paidNow" inputMode="decimal" placeholder="0 if unpaid" className="input" /></Field>
      <Field label="Method"><PaymentMethodSelect /></Field>
      <Field label="Notes" className="sm:col-span-2"><input name="notes" className="input" /></Field>
      <div className="sm:col-span-2"><button className="btn-primary">Add package</button></div>
    </form>
  );
}
