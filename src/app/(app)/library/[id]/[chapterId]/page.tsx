import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { saveChapterNotesAction } from "@/lib/actions/library";
import { BackLink, PageHeader } from "@/components/ui";
import { BookContent } from "@/components/BookContent";

export default async function ChapterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; chapterId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id, chapterId } = await params;
  const { q } = await searchParams;
  const chapter = await prisma.bookChapter.findUnique({ where: { id: chapterId }, include: { book: { select: { id: true, title: true } } } });
  if (!chapter || chapter.bookId !== id) notFound();

  const readable = { bookId: id, isDivider: false };
  const [prev, next] = await Promise.all([
    prisma.bookChapter.findFirst({ where: { ...readable, position: { lt: chapter.position } }, orderBy: { position: "desc" }, select: { id: true, title: true } }),
    prisma.bookChapter.findFirst({ where: { ...readable, position: { gt: chapter.position } }, orderBy: { position: "asc" }, select: { id: true, title: true } }),
  ]);

  const pager = (
    <div className="flex items-start justify-between gap-4 text-sm">
      {prev ? <Link href={`/library/${id}/${prev.id}`} className="text-stone-500 hover:text-emerald-800">← {prev.title}</Link> : <span />}
      {next ? <Link href={`/library/${id}/${next.id}`} className="text-right text-stone-500 hover:text-emerald-800">{next.title} →</Link> : <span />}
    </div>
  );

  return (
    <>
      <BackLink href={`/library/${id}`}>{chapter.book.title}</BackLink>
      <PageHeader title={chapter.title} subtitle={q ? `Showing matches for “${q}”` : undefined} />

      <div className="grid gap-6 lg:grid-cols-3">
        <article className="card lg:col-span-2">
          <div className="mb-6 border-b border-stone-100 pb-4">{pager}</div>
          <div className="mx-auto max-w-prose">
            <BookContent content={chapter.content} highlight={q} />
          </div>
          <div className="mt-6 border-t border-stone-100 pt-4">{pager}</div>
        </article>

        <aside>
          <section className="card lg:sticky lg:top-4">
            <h2 className="mb-1 font-semibold text-stone-900">Your notes</h2>
            <p className="mb-3 text-xs text-stone-500">Takeaways, exercises you pair with this chapter, players it suits.</p>
            <form action={saveChapterNotesAction.bind(null, chapter.id)} className="space-y-3">
              <textarea name="notes" defaultValue={chapter.notes ?? ""} className="input min-h-56" />
              <button className="btn-primary">Save notes</button>
            </form>
          </section>
        </aside>
      </div>
    </>
  );
}
