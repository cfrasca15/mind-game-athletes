import type { Block, Run } from "@/lib/epub";

/** Renders imported book blocks. Text only, so nothing from a book file runs as markup. */
export function BookContent({ content, highlight }: { content: string; highlight?: string }) {
  let blocks: Block[] = [];
  try {
    blocks = JSON.parse(content) as Block[];
  } catch {
    return <p className="text-sm text-stone-500">This chapter could not be displayed.</p>;
  }
  const mark = highlight && highlight.trim().length >= 2 ? highlight.trim() : undefined;

  return (
    <div className="text-[1.02rem] text-stone-800">
      {blocks.map((b, k) => {
        const runs = <Runs runs={b.runs} mark={mark} />;
        switch (b.t) {
          case "h":
            return <h3 key={k} className="mt-7 mb-2 text-lg font-semibold text-stone-900">{runs}</h3>;
          case "quote":
            return <blockquote key={k} className="mb-1 border-l-2 border-emerald-300 pl-4 leading-7 text-stone-700 italic">{runs}</blockquote>;
          case "attr":
            return <p key={k} className="mb-5 pl-4 text-sm text-stone-500">{runs}</p>;
          case "li":
            return <p key={k} className="mb-1 pl-5 leading-7"><span className="-ml-4 mr-2 text-stone-400">•</span>{runs}</p>;
          default:
            return <p key={k} className="mb-4 leading-7">{runs}</p>;
        }
      })}
    </div>
  );
}

function Runs({ runs, mark }: { runs: Run[]; mark?: string }) {
  return (
    <>
      {runs.map((r, k) => {
        const text = mark ? <Marked text={r.s} mark={mark} /> : r.s;
        if (r.b && r.i) return <strong key={k}><em>{text}</em></strong>;
        if (r.b) return <strong key={k}>{text}</strong>;
        if (r.i) return <em key={k}>{text}</em>;
        return <span key={k}>{text}</span>;
      })}
    </>
  );
}

/** Wraps case-insensitive matches of `mark` in a highlight. */
export function Marked({ text, mark }: { text: string; mark: string }) {
  const lower = text.toLowerCase();
  const needle = mark.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(<mark key={at} className="rounded bg-amber-200/70 px-0.5">{text.slice(at, at + needle.length)}</mark>);
    from = at + needle.length;
  }
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}
