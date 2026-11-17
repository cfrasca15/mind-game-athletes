/**
 * Shows an outline or plan typed as plain text, tidied up a little:
 *   "# Warm up"        a section heading
 *   "- Check in"       a bullet ("*" and pasted bullets such as "•" work too)
 *   "  - How was..."   indent to nest
 *   "1. First"         a numbered point
 * A plain line sitting directly above bullets is shown as their heading.
 */

type Line =
  | { kind: "blank" }
  | { kind: "heading"; text: string }
  | { kind: "item"; depth: number; marker: string; text: string }
  | { kind: "text"; depth: number; text: string; lead: boolean };

const BULLET = /^([-*\u2022\u00b7\u25e6\u25aa\u25a0\u25cb\u25cf\u2013\u2014\u2043\u00a7])\s+(.*)$/;
// Word pastes second-level bullets as the letter o followed by a tab.
const WORD_SUB_BULLET = /^o\t+(.*)$/;
const NUMBERED = /^(\d{1,2}|[A-Za-z]|[ivx]{1,4})([.)])\s+(.*)$/;

function parse(source: string): Line[] {
  const lines: Line[] = source.replace(/\r\n?/g, "\n").split("\n").map((raw): Line => {
    const indent = /^[ \t]*/.exec(raw)![0];
    const tabs = indent.split("\t").length - 1;
    const depth = Math.min(4, tabs + Math.floor((indent.length - tabs) / 2));
    const rest = raw.slice(indent.length).trimEnd();
    if (rest === "") return { kind: "blank" };

    const heading = /^#{1,3}\s+(.*)$/.exec(rest);
    if (heading) return { kind: "heading", text: heading[1] };

    const sub = WORD_SUB_BULLET.exec(rest);
    if (sub) return { kind: "item", depth: Math.max(1, depth), marker: "\u25e6", text: sub[1] };

    const bullet = BULLET.exec(rest);
    if (bullet) return { kind: "item", depth, marker: depth === 0 ? "\u2022" : "\u25e6", text: bullet[2] };

    const numbered = NUMBERED.exec(rest);
    if (numbered) return { kind: "item", depth, marker: `${numbered[1]}${numbered[2]}`, text: numbered[3] };

    return { kind: "text", depth, text: rest, lead: false };
  });

  // A plain line right above a list reads as that list's heading.
  lines.forEach((line, i) => {
    if (line.kind === "text" && line.depth === 0 && lines[i + 1]?.kind === "item") line.lead = true;
  });
  return lines;
}

const INDENT = ["", "pl-5", "pl-10", "pl-14", "pl-16"];

export function OutlineText({ text, className = "" }: { text: string; className?: string }) {
  const lines = parse(text);
  return (
    <div className={`space-y-1 text-sm leading-relaxed text-stone-700 ${className}`}>
      {lines.map((line, i) => {
        if (line.kind === "blank") return <div key={i} className="h-2" />;
        if (line.kind === "heading") {
          return <h3 key={i} className="pt-2 text-base font-semibold text-brand-800 first:pt-0">{line.text}</h3>;
        }
        if (line.kind === "item") {
          return (
            <div key={i} className={`flex gap-2 ${INDENT[line.depth]}`}>
              <span className="min-w-3 shrink-0 text-brand-600">{line.marker}</span>
              <span className="min-w-0 break-words">{line.text}</span>
            </div>
          );
        }
        return (
          <p key={i} className={`break-words ${INDENT[line.depth]} ${line.lead ? "pt-1 font-semibold text-stone-900" : ""}`}>
            {line.text}
          </p>
        );
      })}
    </div>
  );
}
