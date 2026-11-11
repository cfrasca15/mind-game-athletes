import { deleteGuardianAction, saveGuardianAction } from "@/lib/actions/clients";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Field } from "@/components/ui";
import type { Guardian } from "@/generated/prisma/client";

function GuardianForm({ clientId, g }: { clientId: string; g?: Guardian }) {
  return (
    <form action={saveGuardianAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="clientId" value={clientId} />
      {g && <input type="hidden" name="id" value={g.id} />}
      <Field label="Name"><input name="name" required defaultValue={g?.name} className="input" /></Field>
      <Field label="Relationship"><input name="relationship" defaultValue={g?.relationship ?? ""} placeholder="Mom, Dad…" className="input" /></Field>
      <Field label="Phone"><input name="phone" defaultValue={g?.phone ?? ""} className="input" /></Field>
      <Field label="Email"><input name="email" type="email" defaultValue={g?.email ?? ""} className="input" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPrimary" defaultChecked={g?.isPrimary ?? true} /> Primary contact</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="billingContact" defaultChecked={g?.billingContact ?? true} /> Gets invoices</label>
      <div className="sm:col-span-2"><button className="btn-primary">{g ? "Save" : "Add parent"}</button></div>
    </form>
  );
}

export function GuardianSection({ clientId, guardians }: { clientId: string; guardians: Guardian[] }) {
  return (
    <section className="card">
      <h2 className="mb-3 font-semibold text-stone-900">Parents / guardians</h2>
      {guardians.length === 0 && <p className="text-sm text-stone-500">None added.</p>}
      <ul className="divide-y divide-stone-100">
        {guardians.map((g) => (
          <li key={g.id} className="py-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-stone-900">
                  {g.name}
                  {g.relationship && <span className="font-normal text-stone-500"> · {g.relationship}</span>}
                  {g.isPrimary && <span className="ml-1 pill bg-emerald-50 text-emerald-700">primary</span>}
                </div>
                {g.phone && <div><a href={`tel:${g.phone}`} className="hover:underline">{g.phone}</a></div>}
                {g.email && <div><a href={`mailto:${g.email}`} className="hover:underline">{g.email}</a></div>}
              </div>
              <ConfirmButton className="text-xs text-red-600 hover:underline" action={deleteGuardianAction.bind(null, g.id, clientId)} message={`Remove ${g.name}?`}>Remove</ConfirmButton>
            </div>
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-stone-500">Edit</summary>
              <div className="mt-2"><GuardianForm clientId={clientId} g={g} /></div>
            </details>
          </li>
        ))}
      </ul>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-emerald-800">+ Add parent</summary>
        <div className="mt-3"><GuardianForm clientId={clientId} /></div>
      </details>
    </section>
  );
}
