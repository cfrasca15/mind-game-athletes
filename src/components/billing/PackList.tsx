import {
  cancelClientPackageAction,
  deleteClientPackageAction,
  reactivateClientPackageAction,
} from "@/lib/actions/packages";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Pill } from "@/components/ui";
import { fmtDate, money } from "@/lib/format";

export type PackRow = {
  id: string;
  name: string;
  sessionCount: number;
  priceCents: number;
  purchasedAt: Date;
  expiresAt: Date | null;
  status: string;
  notes: string | null;
  _count: { sessions: number };
  payments: { amountCents: number }[];
};

export function PackList({ packs }: { packs: PackRow[] }) {
  if (packs.length === 0) return <p className="text-sm text-stone-500">No packages yet.</p>;
  return (
    <ul className="divide-y divide-stone-100">
      {packs.map((p) => {
        const used = p._count.sessions;
        const left = Math.max(0, p.sessionCount - used);
        const paid = p.payments.reduce((s, x) => s + x.amountCents, 0);
        const pct = Math.min(100, Math.round((used / p.sessionCount) * 100));
        return (
          <li key={p.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium text-stone-900">{p.name}</span>{" "}
                <Pill status={p.status} label={p.status === "ACTIVE" ? `${left} left` : p.status.toLowerCase()} />
              </div>
              <div className="text-sm text-stone-500">
                {money(paid)} of {money(p.priceCents)} paid
                {paid < p.priceCents && <span className="ml-1 font-medium text-amber-700">· {money(p.priceCents - paid)} due</span>}
              </div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
              <span>
                {used} of {p.sessionCount} used · bought {fmtDate(p.purchasedAt)}
                {p.expiresAt && ` · expires ${fmtDate(p.expiresAt)}`}
                {p.notes && ` · ${p.notes}`}
              </span>
              <span className="flex gap-2">
                {p.status === "CANCELLED" ? (
                  <ConfirmButton className="text-xs text-stone-500 hover:underline" action={reactivateClientPackageAction.bind(null, p.id)} message="Reactivate this package?">Reactivate</ConfirmButton>
                ) : (
                  <ConfirmButton className="text-xs text-stone-500 hover:underline" action={cancelClientPackageAction.bind(null, p.id)} message="Cancel this package? It will no longer count toward what is owed.">Cancel</ConfirmButton>
                )}
                {used === 0 && (
                  <ConfirmButton className="text-xs text-red-600 hover:underline" action={deleteClientPackageAction.bind(null, p.id)} message="Delete this package purchase? Payments linked to it will stay but become unlinked.">Delete</ConfirmButton>
                )}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
