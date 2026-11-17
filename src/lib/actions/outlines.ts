"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { str } from "@/lib/format";

const MAX_LENGTH = 50_000;

/** Outlines show on every session page and in the upcoming lists. */
function refreshEverywhere() {
  revalidatePath("/", "layout");
}

/** Create an outline (id null) or save changes to one. */
export async function saveOutlineAction(id: string | null, fd: FormData) {
  await requireUser();
  const name = str(fd.get("name")) ?? "Outline";
  const content = String(fd.get("content") ?? "").replace(/\r\n?/g, "\n").trimEnd().slice(0, MAX_LENGTH);
  if (content.trim() === "") redirect("/outline");

  if (id) {
    await prisma.outline.update({ where: { id }, data: { name, content } });
  } else {
    const last = await prisma.outline.aggregate({ _max: { position: true } });
    await prisma.outline.create({ data: { name, content, position: (last._max.position ?? -1) + 1 } });
  }
  refreshEverywhere();
  redirect("/outline");
}

/** Move an outline to the front, so it is the one that opens first. */
export async function makeMainOutlineAction(id: string) {
  await requireUser();
  const first = await prisma.outline.aggregate({ _min: { position: true } });
  await prisma.outline.update({ where: { id }, data: { position: (first._min.position ?? 0) - 1 } });
  refreshEverywhere();
}

export async function deleteOutlineAction(id: string) {
  await requireUser();
  await prisma.outline.deleteMany({ where: { id } });
  refreshEverywhere();
  redirect("/outline");
}
