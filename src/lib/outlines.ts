import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type OutlineItem = { id: string; name: string; content: string };

/** Every outline, main one first. Asked for once per page load. */
export const getOutlines = cache(async (): Promise<OutlineItem[]> =>
  prisma.outline.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, content: true },
  }),
);
