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

export function PaymentList({ payments }: { payments: PaymentRow[] }) {
  if (payments.length === 0) return <p className="text-sm text-stone-500">No payments recorded.</p>;
  return (
    <table className="table">
      <thead>
        <tr><th>Date</th><th>Amount</th><th>Method</th><th>For</th><th></th></tr>
      </thead>
      <tbody>
        {payments.map((p) => (
          <tr key={p.id}>
            <td>{fmtDate(p.paidAt)}</td>
            <td className="font-medium">{money(p.amountCents)}</td>
            <td>{PAYMENT_METHOD_LABEL[p.method]}</td>
            <td className="text-stone-500">{p.clientPackage?.name ?? "—"}{p.note ? ` · ${p.note}` : ""}</td>
            <td className="text-right">
              <ConfirmButton className="text-xs text-red-600 hover:underline" action={deletePaymentAction.bind(null, p.id)} message="Delete this payment?">Delete</ConfirmButton>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
