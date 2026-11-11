import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Empty, PageHeader } from "@/components/ui";
import { Marked } from "@/components/BookContent";
import { UploadBookForm } from "./UploadBookForm";

/** A short stretch of text around the first match. */
function snippet(text: string, q: string) {
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at === -1) return null;
  const from = Math.max(0, at - 90);
  const to = Math.min(text.length, at + q.length + 130);
  return `${from > 0 ? "…" : ""}${text.slice(from, to).replace(/\s+/g, " ")}${to < text.length ? "…" : ""}`;
}

function count(text: string, q: string) {
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let n = 0;
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + needle.length)) n++;
  return n;
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; book?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const searching = q.length >= 2;

  const books = await prisma.book.findMany({
    orderBy: { title: "asc" },
    include: { _count: { select: { chapters: { where: { isDivider: false } } } } },
  });

  const hits = searching
    ? await prisma.bookChapter.findMany({
        where: {
          isDivider: false,
          ...(sp.book ? { bookId: sp.book } : {}),
          OR: [{ text: { contains: q } }, { title: { contains: q } }, { notes: { contains: q } }],
        },
        orderBy: [{ bookId: "asc" }, { position: "asc" }],
        select: { id: true, bookId: true, title: true, text: true, notes: true, book: { select: { title: true } } },
        take: 60,
      })
    : [];
  const scoped = sp.book ? books.find((b) => b.id === sp.book) : undefined;

  return (
    <>
      <PageHeader title="Library" subtitle="Books you work from. Look something up while you plan a session." />

      <form className="mb-6 flex flex-wrap gap-2">
        {sp.book && <input type="hidden" name="book" value={sp.book} />}
        <input name="q" defaultValue={q} className="input max-w-md" placeholder={scoped ? `Search in ${scoped.title}…` : "Search every book: confidence, pressure, focus…"} />
        <button className="btn">Search</button>
        {(q || sp.book) && <Link href="/library" className="btn">Clear</Link>}
      </form>

      {searching ? (
        <section className="card">
          <h2 className="mb-3 font-semibold text-stone-900">
            {hits.length === 0 ? "Nothing found" : `${hits.length} chapter${hits.length === 1 ? "" : "s"} mention`} &ldquo;{q}&rdquo;{scoped ? ` in ${scoped.title}` : ""}
          </h2>
          <ul className="divide-y divide-stone-100">
            {hits.map((h) => {
              const inText = count(h.text, q);
              const fromNotes = h.notes ? snippet(h.notes, q) : null;
              const fromText = snippet(h.text, q);
              return (
                <li key={h.id} className="py-3 text-sm">
                  <Link href={`/library/${h.bookId}/${h.id}?q=${encodeURIComponent(q)}`} className="font-medium text-stone-900 hover:underline">{h.title}</Link>
                  <span className="text-stone-500"> · {h.book.title}{inText > 0 && ` · ${inText} mention${inText === 1 ? "" : "s"}`}</span>
                  {fromText && <p className="mt-1 text-stone-600"><Marked text={fromText} mark={q} /></p>}
                  {fromNotes && <p className="mt-1 text-brand-800"><span className="font-medium">Your notes:</span> <Marked text={fromNotes} mark={q} /></p>}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {books.length === 0 && <Empty>No books yet. Add your first one on the right.</Empty>}
            {books.map((b) => (
              <Link key={b.id} href={`/library/${b.id}`} className="card block hover:border-brand-300">
                <div className="font-semibold text-stone-900">{b.title}</div>
                <div className="mt-1 text-sm text-stone-500">{b.author ? `${b.author} · ` : ""}{b._count.chapters} chapter{b._count.chapters === 1 ? "" : "s"}</div>
              </Link>
            ))}
          </div>
          <section className="card h-fit">
            <h2 className="mb-3 font-semibold text-stone-900">Add a book</h2>
            <UploadBookForm />
          </section>
        </div>
      )}
    </>
  );
}
