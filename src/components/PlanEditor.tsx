"use client";

import { useState, useTransition } from "react";
import { savePlanAction } from "@/lib/actions/sessions";
import type { OutlineItem } from "@/lib/outlines";

/**
 * Where she writes the plan for an upcoming session. Saves when she clicks
 * Save or clicks away from the box, so nothing typed gets left behind.
 */
export function PlanEditor({
  sessionId,
  initial,
  outlines,
  lastFocus,
  compact = false,
}: {
  sessionId: string;
  initial: string;
  outlines: OutlineItem[];
  /** "Focus for next session" from the one before this, if she wrote one. */
  lastFocus?: string | null;
  compact?: boolean;
}) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [savedOnce, setSavedOnce] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save(value: string) {
    if (value === saved) return;
    start(async () => {
      try {
        const res = await savePlanAction(sessionId, value);
        if (res.ok) {
          setSaved(value);
          setSavedOnce(true);
          setProblem(null);
        } else setProblem(res.message);
      } catch {
        setProblem("Could not save. Check the connection and try again.");
      }
    });
  }

  /** Adds a block of text under whatever is already there, and saves. */
  function add(block: string) {
    const next = text.trim() === "" ? block : `${text.trimEnd()}\n\n${block}`;
    setText(next);
    save(next);
  }

  const dirty = text !== saved;
  const focusUsed = !lastFocus || text.includes(lastFocus.trim());

  return (
    <div className="space-y-3">
      {lastFocus && (
        <div className="rounded-lg border border-brand-100 bg-brand-50 p-3 text-sm text-brand-900">
          <span className="font-medium">Focus you set last time:</span>{" "}
          <span className="whitespace-pre-line">{lastFocus}</span>
          {!focusUsed && (
            <button type="button" onClick={() => add(lastFocus.trim())} className="ml-2 font-medium underline hover:no-underline">Add to plan</button>
          )}
        </div>
      )}
      <textarea
        aria-label="Plan for this session"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => save(text)}
        className={`input field-sizing-content max-h-[70vh] ${compact ? "min-h-28" : "min-h-40"}`}
        placeholder="What you want to cover, exercises to try, questions to ask…"
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="button" disabled={pending || !dirty} onClick={() => save(text)} className="btn-primary">
          {pending ? "Saving…" : "Save plan"}
        </button>
        {outlines.length === 1 && (
          <button type="button" disabled={pending} onClick={() => add(outlines[0].content)} className="btn">Start from my outline</button>
        )}
        {outlines.length > 1 && (
          <select
            aria-label="Start from an outline"
            className="input w-auto rounded-full"
            value=""
            disabled={pending}
            onChange={(e) => {
              const o = outlines.find((x) => x.id === e.target.value);
              if (o) add(o.content);
            }}
          >
            <option value="">Start from an outline…</option>
            {outlines.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <span className={`text-sm ${problem ? "text-amber-700" : "text-stone-500"}`} role="status">
          {problem ?? (pending ? "" : dirty ? "Not saved yet" : savedOnce ? "Saved" : "")}
        </span>
        <a href="/library" target="_blank" rel="noreferrer" className="ml-auto text-xs font-medium text-brand-800 hover:underline">Look something up in the Library</a>
      </div>
    </div>
  );
}
