"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { str } from "@/lib/format";
import { EpubError, parseEpub, plain } from "@/lib/epub";

const MAX_FILE = 20 * 1024 * 1024;

/** Read an uploaded EPUB into the library. */
export async function importBookAction(_prev: string | null, fd: FormData): Promise<string> {
  await requireUser();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return "Choose a book file first.";
  if (file.size > MAX_FILE) return "That file is too large. The limit is 20 MB.";

  let parsed;
  try {
    parsed = parseEpub(new Uint8Array(await file.arrayBuffer()), file.name.replace(/\.epub$/i, ""));
  } catch (e) {
    return e instanceof EpubError ? e.message : "That book file could not be read.";
  }

  const book = await prisma.book.create({
    data: {
      title: parsed.title,
      author: parsed.author,
      chapters: {
        create: parsed.chapters.map((c, i) => ({
          position: i,
          title: c.title,
          isDivider: c.isDivider,
          content: JSON.stringify(c.blocks),
          text: c.blocks.map((b) => plain(b.runs)).join("\n"),
        })),
      },
    },
  });
  revalidatePath("/library");
  redirect(`/library/${book.id}`);
}

export async function updateBookAction(id: string, fd: FormData) {
  await requireUser();
  const title = str(fd.get("title"));
  if (!title) throw new Error("The book needs a title.");
  await prisma.book.update({ where: { id }, data: { title, author: str(fd.get("author")) } });
  revalidatePath("/library");
  revalidatePath(`/library/${id}`);
}

export async function saveBookNotesAction(id: string, fd: FormData) {
  await requireUser();
  await prisma.book.update({ where: { id }, data: { notes: str(fd.get("notes")) } });
  revalidatePath(`/library/${id}`);
}

export async function saveChapterNotesAction(chapterId: string, fd: FormData) {
  await requireUser();
  const c = await prisma.bookChapter.update({ where: { id: chapterId }, data: { notes: str(fd.get("notes")) } });
  revalidatePath(`/library/${c.bookId}`);
  revalidatePath(`/library/${c.bookId}/${chapterId}`);
}

export async function deleteBookAction(id: string) {
  await requireUser();
  await prisma.book.delete({ where: { id } });
  revalidatePath("/library");
  redirect("/library");
}
