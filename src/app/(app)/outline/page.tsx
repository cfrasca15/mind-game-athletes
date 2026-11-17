import Link from "next/link";
import { getOutlines, type OutlineItem } from "@/lib/outlines";
import { deleteOutlineAction, makeMainOutlineAction, saveOutlineAction } from "@/lib/actions/outlines";
import { Field, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";
import { OutlineText } from "@/components/OutlineText";

const EXAMPLE = `# Check-in
- How was the week? Wins and tough moments
- Review last session and the homework

# Today
- Main skill or topic
  - Exercise
  - What she noticed

# Wrap up
- One thing to practice before next time`;

export default async function OutlinePage({ searchParams }: { searchParams: Promise<{ edit?: string; new?: string }> }) {
  const sp = await searchParams;
  const outlines = await getOutlines();
  const adding = outlines.length === 0 || sp.new !== undefined;

  return (
    <>
      <PageHeader
        title="Outline"
        subtitle="What you follow during a meeting. It opens from a dropdown on every session page, and you can start a session plan from it."
        actions={!adding && !sp.edit && <Link href="/outline?new" className="btn">+ Add another outline</Link>}
      />

      <div className="space-y-6">
        {outlines.map((o, i) =>
          sp.edit === o.id ? (
            <OutlineForm key={o.id} outline={o} />
          ) : (
            <section key={o.id} className="card">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-semibold text-stone-900">
                  {o.name}
                  {outlines.length > 1 && i === 0 && <span className="pill bg-brand-50 text-brand-700">Main</span>}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/outline?edit=${o.id}`} className="btn">Edit</Link>
                  {i > 0 && (
                    <form action={makeMainOutlineAction.bind(null, o.id)}>
                      <button className="btn">Make this the main one</button>
                    </form>
                  )}
                  <ConfirmButton action={deleteOutlineAction.bind(null, o.id)} message={`Delete the outline "${o.name}"? Session plans already started from it are not changed.`}>Delete</ConfirmButton>
                </div>
              </div>
              <OutlineText text={o.content} />
            </section>
          ),
        )}

        {adding && <OutlineForm first={outlines.length === 0} />}
      </div>
    </>
  );
}

function OutlineForm({ outline, first = false }: { outline?: OutlineItem; first?: boolean }) {
  return (
    <form action={saveOutlineAction.bind(null, outline?.id ?? null)} className="card space-y-4">
      <h2 className="font-semibold text-stone-900">{outline ? "Edit outline" : first ? "Write your outline" : "Add another outline"}</h2>
      <Field label="Name">
        <input name="name" required defaultValue={outline?.name ?? (first ? "Main outline" : "")} className="input max-w-sm" placeholder="Team session" />
      </Field>
      <Field label="Outline">
        <textarea name="content" required defaultValue={outline?.content ?? ""} className="input field-sizing-content min-h-72" placeholder={EXAMPLE} spellCheck />
      </Field>
      <p className="text-xs text-stone-500">
        One point per line. Start a line with <b>-</b> for a bullet, put two spaces in front to tuck it under the one above, and start a line with <b>#</b> for a section heading. Pasting from Word or Google Docs works as well.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary">Save outline</button>
        {!first && <Link href="/outline" className="btn">Cancel</Link>}
      </div>
    </form>
  );
}
