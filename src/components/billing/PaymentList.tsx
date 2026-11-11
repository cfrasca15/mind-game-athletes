import { deletePaymentAction } from "@/lib/actions/payments";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PAYMENT_METHOD_LABEL, fmtDate, money } from "@/lib/format";

export type PaymentRow = {
  id: string;
  amountCents: number;
  paidAt: Date;
  method: string;
  note: string | null;
  clientPackage: { name: string } | null;
};

/** A stacked list rather than a table: this sits in a narrow side column. */
export function PaymentList({ payments }: { payments: PaymentRow[] }) {
  if (payments.length === 0) return <p className="text-sm text-stone-500">No payments recorded.</p>;
  return (
    <ul className="divide-y divide-stone-100">
      {payments.map((p) => {
        const what = [p.clientPackage?.name, p.note].filter(Boolean).join(" · ");
        return (
          <li key={p.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <div>
                <span className="font-bold text-stone-900">{money(p.amountCents)}</span>
                <span className="text-stone-500"> · {PAYMENT_METHOD_LABEL[p.method]} · {fmtDate(p.paidAt)}</span>
              </div>
              {what && <div className="mt-0.5 text-xs text-stone-500">{what}</div>}
            </div>
            <ConfirmButton className="shrink-0 text-xs text-red-600 hover:underline" action={deletePaymentAction.bind(null, p.id)} message="Delete this payment?">Delete</ConfirmButton>
          </li>
        );
      })}
    </ul>
  );
}
