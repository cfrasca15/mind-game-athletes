import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { deletePackageAction, savePackageAction, togglePackageActiveAction } from "@/lib/actions/packages";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Field, PageHeader } from "@/components/ui";
import { money } from "@/lib/format";
import { ProfileForms } from "./ProfileForms";

export default async function SettingsPage() {
  const user = await requireUser();
  const packages = await prisma.package.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { clientPackages: true } } },
  });

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="mb-1 font-semibold text-stone-900">Packages you sell</h2>
            <p className="mb-4 text-sm text-stone-500">Single sessions, multi-packs and team programs. Editing a package here does not change packs already sold.</p>
            {packages.length === 0 && <p className="text-sm text-stone-500">Nothing yet. Add your first package below.</p>}
            <ul className="divide-y divide-stone-100">
              {packages.map((p) => (
                <li key={p.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div>
                      <span className={`font-medium ${p.active ? "text-stone-900" : "text-stone-400 line-through"}`}>{p.name}</span>
                      <span className="text-stone-500"> · {p.sessionCount} session{p.sessionCount === 1 ? "" : "s"} · {money(p.priceCents)}</span>
                      {p.expiresDays && <span className="text-stone-500"> · expires after {p.expiresDays} days</span>}
                      {p.forTeams && <span className="pill ml-2 bg-sky-50 text-sky-700">team</span>}
                      <span className="ml-2 text-xs text-stone-400">sold {p._count.clientPackages}×</span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <ConfirmButton className="text-stone-500 hover:underline" action={togglePackageActiveAction.bind(null, p.id, !p.active)} message={p.active ? "Hide this package from the purchase list?" : "Show this package again?"}>{p.active ? "Hide" : "Show"}</ConfirmButton>
                      <ConfirmButton className="text-red-600 hover:underline" action={deletePackageAction.bind(null, p.id)} message={p._count.clientPackages > 0 ? "This package has been sold, so it will be hidden rather than deleted. Continue?" : "Delete this package?"}>Delete</ConfirmButton>
                    </div>
                  </div>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-stone-500">Edit</summary>
                    <div className="mt-2"><PackageForm p={p} /></div>
                  </details>
                </li>
              ))}
            </ul>
            <details className="mt-4" open={packages.length === 0}>
              <summary className="cursor-pointer text-sm font-medium text-emerald-800">+ Add package</summary>
              <div className="mt-3"><PackageForm /></div>
            </details>
          </section>
        </div>
        <div className="space-y-6">
          <ProfileForms name={user.name} email={user.email} />
        </div>
      </div>
    </>
  );
}

function PackageForm({ p }: { p?: { id: string; name: string; sessionCount: number; priceCents: number; expiresDays: number | null; forTeams: boolean; sortOrder: number } }) {
  return (
    <form action={savePackageAction} className="grid gap-3 sm:grid-cols-3">
      {p && <input type="hidden" name="id" value={p.id} />}
      <Field label="Name" className="sm:col-span-3"><input name="name" required defaultValue={p?.name} className="input" placeholder="6-session pack" /></Field>
      <Field label="Sessions"><input name="sessionCount" type="number" min={1} required defaultValue={p?.sessionCount ?? 1} className="input" /></Field>
      <Field label="Price ($)"><input name="price" inputMode="decimal" required defaultValue={p ? (p.priceCents / 100).toFixed(2) : ""} className="input" /></Field>
      <Field label="Expires after (days)"><input name="expiresDays" type="number" min={1} defaultValue={p?.expiresDays ?? ""} className="input" placeholder="never" /></Field>
      <Field label="Sort order"><input name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} className="input" /></Field>
      <label className="flex items-center gap-2 self-end text-sm sm:col-span-2"><input type="checkbox" name="forTeams" defaultChecked={p?.forTeams ?? false} /> Team program (only offered to teams)</label>
      <div className="sm:col-span-3"><button className="btn-primary">{p ? "Save" : "Add package"}</button></div>
    </form>
  );
}
