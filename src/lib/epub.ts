import { unzipSync } from "fflate";
import { parse, NodeType, type HTMLElement, type Node } from "node-html-parser";
import path from "node:path";

/**
 * Reads an EPUB she uploads into plain, safe blocks. No HTML from the file is
 * ever stored or rendered: only text, with bold/italic flags, so a book file
 * cannot inject markup or scripts into the app.
 */

export type Run = { s: string; i?: true; b?: true };
export type Block =
  | { t: "h"; level: number; runs: Run[] }
  | { t: "p"; runs: Run[] }
  | { t: "quote"; runs: Run[] }
  | { t: "attr"; runs: Run[] }
  | { t: "li"; runs: Run[] };

export type ParsedChapter = { title: string; isDivider: boolean; blocks: Block[] };
export type ParsedBook = { title: string; author: string | null; chapters: ParsedChapter[] };

export class EpubError extends Error {}

const MAX_UNZIPPED = 60 * 1024 * 1024;
const TEXT_FILE = /\.(opf|ncx|xhtml|html|htm|xml)$/i;
// Front matter that is no use as a reference.
const SKIP = /^(cover|title(\s*page)?|copyright(\s*page)?|(table\s+of\s+)?contents|toc|nav)$/i;

const posix = path.posix;

export function parseEpub(data: Uint8Array, fallbackTitle: string): ParsedBook {
  let files: Record<string, Uint8Array>;
  let total = 0;
  try {
    files = unzipSync(data, {
      filter: (f) => {
        if (!TEXT_FILE.test(f.name)) return false;
        total += f.originalSize;
        if (total > MAX_UNZIPPED) throw new EpubError("That file is too large to read.");
        return true;
      },
    });
  } catch (e) {
    if (e instanceof EpubError) throw e;
    throw new EpubError("That file could not be opened. It needs to be an EPUB book file (ending in .epub).");
  }
  const decoder = new TextDecoder("utf-8");
  const text = (name: string) => {
    const f = files[name];
    return f ? decoder.decode(f) : null;
  };

  const container = text("META-INF/container.xml");
  const opfPath = container && /full-path="([^"]+)"/.exec(container)?.[1];
  const opf = opfPath ? text(opfPath) : null;
  if (!opfPath || !opf) throw new EpubError("That file is not a valid EPUB book.");
  const opfDir = posix.dirname(opfPath);
  const resolve = (dir: string, href: string) => posix.normalize(posix.join(dir, safeDecode(href.split("#")[0])));

  // Manifest: id -> file
  const manifest = new Map<string, { href: string; type: string; props: string }>();
  for (const tag of opf.match(/<item\b[^>]*>/g) ?? []) {
    const id = attr(tag, "id");
    const href = attr(tag, "href");
    if (id && href) manifest.set(id, { href: resolve(opfDir, href), type: attr(tag, "media-type") ?? "", props: attr(tag, "properties") ?? "" });
  }

  // Reading order
  const spine: string[] = [];
  for (const tag of opf.match(/<itemref\b[^>]*>/g) ?? []) {
    if (attr(tag, "linear") === "no") continue;
    const item = manifest.get(attr(tag, "idref") ?? "");
    if (item) spine.push(item.href);
  }
  if (spine.length === 0) throw new EpubError("That book has no readable chapters.");

  const labels = tocLabels(opf, manifest, opfDir, text, resolve);

  const chapters: ParsedChapter[] = [];
  let readable = 0;
  for (const file of spine) {
    const html = text(file);
    if (html == null) continue;
    const blocks = toBlocks(html);
    const label = labels.get(file);
    const base = posix.basename(file).replace(/\.[^.]+$/, "");
    if (SKIP.test(label ?? "") || SKIP.test(base)) continue;
    if (blocks.length === 0) continue;

    const firstHeading = blocks.find((b) => b.t === "h");
    const title = clean(label ?? (firstHeading ? plain(firstHeading.runs) : ""));
    if (!title) {
      // Not in the table of contents and no heading of its own: it continues the previous chapter.
      const prev = chapters[chapters.length - 1];
      if (prev && !prev.isDivider) {
        prev.blocks.push(...blocks);
        continue;
      }
    }
    // The chapter title is shown by the page, so drop a first heading that repeats it.
    const body = blocks[0]?.t === "h" && same(plain(blocks[0].runs), title) ? blocks.slice(1) : blocks;
    const length = body.reduce((n, b) => n + plain(b.runs).length, 0);
    readable += length;
    chapters.push({ title: title || (chapters.length === 0 ? "Opening pages" : "Untitled section"), isDivider: length < 200 && !!firstHeading, blocks: body });
  }

  if (chapters.length === 0 || readable < 500) {
    const locked = "META-INF/encryption.xml" in files;
    throw new EpubError(
      locked
        ? "That book file is copy-protected, so its text cannot be read. A copy without DRM is needed."
        : "No readable text was found in that book file.",
    );
  }

  const title = clean(decodeEntities(strip(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i.exec(opf)?.[1] ?? ""))) || fallbackTitle;
  const authors = [...opf.matchAll(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/gi)]
    .map((m) => clean(decodeEntities(strip(m[1]))))
    .filter(Boolean);
  return { title, author: authors.length ? authors.join(", ") : null, chapters };
}

/** file -> title from the table of contents (EPUB 2 toc.ncx, or EPUB 3 nav document). */
function tocLabels(
  opf: string,
  manifest: Map<string, { href: string; type: string; props: string }>,
  opfDir: string,
  text: (name: string) => string | null,
  resolve: (dir: string, href: string) => string,
): Map<string, string> {
  const labels = new Map<string, string>();
  const add = (file: string, label: string) => {
    const l = clean(label);
    if (l && !labels.has(file)) labels.set(file, l);
  };

  const ncxItem = [...manifest.values()].find((m) => m.type === "application/x-dtbncx+xml" || /\.ncx$/i.test(m.href));
  const ncx = ncxItem && text(ncxItem.href);
  if (ncx && ncxItem) {
    const dir = posix.dirname(ncxItem.href);
    for (const m of ncx.matchAll(/<navPoint\b[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<content\b[^>]*\bsrc="([^"]+)"/g)) {
      add(resolve(dir, decodeEntities(m[2])), decodeEntities(strip(m[1])));
    }
  }
  const navItem = [...manifest.values()].find((m) => /\bnav\b/.test(m.props));
  const nav = navItem && text(navItem.href);
  if (nav && navItem) {
    const dir = posix.dirname(navItem.href);
    for (const a of parse(nav).querySelectorAll("a")) {
      const href = a.getAttribute("href");
      if (href && !/^[a-z]+:/i.test(href)) add(resolve(dir, href), a.text);
    }
  }
  void opf;
  void opfDir;
  return labels;
}

const HEADING = /^h([1-6])$/;
const TEXT_BLOCK = new Set(["p", "li", "dt", "dd", "figcaption", "td", "th", "caption", "pre", "address"]);
const IGNORE = new Set(["script", "style", "head", "img", "svg", "audio", "video", "iframe", "object", "nav", "math"]);

/** Turn one XHTML file into blocks. */
export function toBlocks(html: string): Block[] {
  const root = parse(html, { blockTextElements: { script: false, style: false, noscript: false, pre: true } });
  const body = root.querySelector("body") ?? root;
  const out: Block[] = [];
  walk(body, out, false);
  return out;
}

function walk(el: HTMLElement, out: Block[], quoted: boolean) {
  let loose: Node[] = [];
  const flush = () => {
    const runs = inline(loose);
    if (runs.length) out.push({ t: quoted ? "quote" : "p", runs });
    loose = [];
  };

  for (const child of el.childNodes) {
    if (child.nodeType !== NodeType.ELEMENT_NODE) {
      if (child.nodeType === NodeType.TEXT_NODE) loose.push(child);
      continue;
    }
    const c = child as HTMLElement;
    const tag = c.rawTagName?.toLowerCase() ?? "";
    if (IGNORE.has(tag)) continue;
    const cls = c.getAttribute("class") ?? "";

    const h = HEADING.exec(tag);
    if (h) {
      flush();
      const runs = inline([c]);
      if (runs.length) out.push({ t: "h", level: Number(h[1]), runs });
    } else if (TEXT_BLOCK.has(tag) && !hasBlockChild(c)) {
      flush();
      const runs = inline([c]);
      if (!runs.length) continue;
      const kind: Block["t"] =
        /\b(att|attr|attribution|source|credit)\w*\b/i.test(cls) ? "attr"
        : quoted || /\b(bq|quote|blockquote|epigraph|extract)\w*\b/i.test(cls) ? "quote"
        : tag === "li" ? "li"
        : "p";
      out.push({ t: kind, runs } as Block);
    } else if (tag === "blockquote") {
      flush();
      walk(c, out, true);
    } else if (hasBlockChild(c) || tag === "div" || tag === "section" || tag === "article" || tag === "ul" || tag === "ol" || tag === "table" || tag === "tr" || tag === "tbody") {
      flush();
      walk(c, out, quoted);
    } else if (tag === "br") {
      loose.push(child);
    } else {
      // Inline element sitting directly in a container.
      loose.push(child);
    }
  }
  flush();
}

function hasBlockChild(el: HTMLElement): boolean {
  return el.childNodes.some((n) => {
    if (n.nodeType !== NodeType.ELEMENT_NODE) return false;
    const tag = (n as HTMLElement).rawTagName?.toLowerCase() ?? "";
    return HEADING.test(tag) || TEXT_BLOCK.has(tag) || ["div", "blockquote", "ul", "ol", "table", "section"].includes(tag) || hasBlockChild(n as HTMLElement);
  });
}

/** Flatten inline content to runs of text with italic/bold flags. */
function inline(nodes: Node[]): Run[] {
  const runs: Run[] = [];
  const push = (s: string, i: boolean, b: boolean) => {
    if (!s) return;
    const last = runs[runs.length - 1];
    if (last && !!last.i === i && !!last.b === b) last.s += s;
    else runs.push({ s, ...(i ? { i: true as const } : {}), ...(b ? { b: true as const } : {}) });
  };
  const visit = (n: Node, i: boolean, b: boolean) => {
    if (n.nodeType === NodeType.TEXT_NODE) {
      push(n.text.replace(/\s+/g, " "), i, b);
      return;
    }
    if (n.nodeType !== NodeType.ELEMENT_NODE) return;
    const el = n as HTMLElement;
    const tag = el.rawTagName?.toLowerCase() ?? "";
    if (IGNORE.has(tag)) return;
    if (tag === "br") return push(" ", i, b);
    const ii = i || tag === "em" || tag === "i" || tag === "cite";
    const bb = b || tag === "strong" || tag === "b";
    for (const c of el.childNodes) visit(c, ii, bb);
  };
  for (const n of nodes) visit(n, false, false);

  // Tidy whitespace at the edges and between runs.
  for (let k = 0; k < runs.length; k++) runs[k].s = runs[k].s.replace(/ {2,}/g, " ");
  if (runs.length) {
    runs[0].s = runs[0].s.replace(/^\s+/, "");
    runs[runs.length - 1].s = runs[runs.length - 1].s.replace(/\s+$/, "");
  }
  return runs.filter((r) => r.s.length > 0);
}

export const plain = (runs: Run[]) => runs.map((r) => r.s).join("");

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const strip = (s: string) => s.replace(/<[^>]+>/g, "");
const same = (a: string, b: string) => clean(a).toLowerCase() === clean(b).toLowerCase();

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag) ?? new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i").exec(tag);
  return m ? decodeEntities(m[1]) : null;
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}
