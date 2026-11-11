import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteBookAction, saveBookNotesAction, updateBookAction } from "@/lib/actions/library";
import { BackLink, Field, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/ConfirmButton";

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    include: { chapters: { orderBy: { position: "asc" }, select: { id: true, title: true, isDivider: true, notes: true } } },
  });
  if (!book) notFound();

  return (
    <>
      <BackLink href="/library">Library</BackLink>
      <PageHeader
        title={book.title}
        subtitle={book.author ?? undefined}
        actions={<ConfirmButton action={deleteBookAction.bind(null, book.id)} message="Remove this book and your notes on it from the library?">Remove</ConfirmButton>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-stone-900">Contents</h2>
            <form action="/library" className="flex gap-2">
              <input type="hidden" name="book" value={book.id} />
              <input name="q" className="input w-56" placeholder="Search this book…" />
              <button className="btn">Search</button>
            </form>
          </div>
          <ul>
            {book.chapters.map((c) =>
              c.isDivider ? (
                <li key={c.id} className="mt-5 mb-1 text-xs font-semibold tracking-wide text-stone-500 uppercase first:mt-0">{c.title}</li>
              ) : (
                <li key={c.id} className="border-t border-stone-100 first:border-t-0">
                  <Link href={`/library/${book.id}/${c.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-brand-800">
                    <span>{c.title}</span>
                    {c.notes && <span className="pill bg-brand-50 text-brand-700">your notes</span>}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="card">
            <h2 className="mb-3 font-semibold text-stone-900">Your notes on this book</h2>
            <form action={saveBookNotesAction.bind(null, book.id)} className="space-y-3">
              <textarea name="notes" defaultValue={book.notes ?? ""} className="input min-h-32" placeholder="How you use it, which chapters work for which kind of player…" />
              <button className="btn-primary">Save notes</button>
            </form>
          </section>
          <section className="card">
            <details>
              <summary className="cursor-pointer text-sm font-medium text-stone-700">Edit title and author</summary>
              <form action={updateBookAction.bind(null, book.id)} className="mt-3 space-y-3">
                <Field label="Title"><input name="title" required defaultValue={book.title} className="input" /></Field>
                <Field label="Author"><input name="author" defaultValue={book.author ?? ""} className="input" /></Field>
                <button className="btn">Save</button>
              </form>
            </details>
          </section>
        </div>
      </div>
    </>
  );
}
