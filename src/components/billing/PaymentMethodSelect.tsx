import { PAYMENT_METHOD_LABEL } from "@/lib/format";

export function PaymentMethodSelect({ defaultValue = "VENMO" }: { defaultValue?: string }) {
  return (
    <select name="method" defaultValue={defaultValue} className="input">
      {Object.entries(PAYMENT_METHOD_LABEL).map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}
