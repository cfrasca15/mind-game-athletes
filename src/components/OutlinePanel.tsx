"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { OutlineText } from "@/components/OutlineText";
import type { OutlineItem } from "@/lib/outlines";

// Remembers, on this device, whether the outline was left open and which one was showing.
const OPEN_KEY = "mga.outline.open";
const PICK_KEY = "mga.outline.pick";
const CHANGED = "mga-outline-changed";
const memory = new Map<string, string>();

function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private windows may refuse. It still works until the page is closed.
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function useRemembered(key: string) {
  return useSyncExternalStore(subscribe, () => read(key), () => null);
}

/** The meeting outline, tucked into a dropdown on the session page. */
export function OutlinePanel({ outlines }: { outlines: OutlineItem[] }) {
  const open = useRemembered(OPEN_KEY) === "1";
  const picked = useRemembered(PICK_KEY);

  if (outlines.length === 0) {
    return (
      <section className="card">
        <h2 className="mb-1 font-semibold text-stone-900">Meeting outline</h2>
        <p className="text-sm text-stone-500">
          Keep the outline you follow here so it is one click away during a session.{" "}
          <Link href="/outline" className="font-medium text-brand-800 hover:underline">Write your outline</Link>
        </p>
      </section>
    );
  }

  const current = outlines.find((o) => o.id === picked) ?? outlines[0];
  return (
    <details
      className="card"
      open={open}
      onToggle={(e) => {
        const now = e.currentTarget.open;
        if (now !== open) write(OPEN_KEY, now ? "1" : "0");
      }}
    >
      <summary className="font-semibold text-stone-900">
        <h2 className="inline">Meeting outline</h2>
        {!open && <span className="ml-2 text-xs font-normal text-stone-500">Click to open</span>}
      </summary>
      <div className="mt-3 space-y-3">
        {outlines.length > 1 && (
          <select
            aria-label="Which outline"
            className="input"
            value={current.id}
            onChange={(e) => write(PICK_KEY, e.target.value)}
          >
            {outlines.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          <OutlineText text={current.content} />
        </div>
        <Link href={`/outline?edit=${current.id}`} className="inline-block text-xs font-medium text-brand-800 hover:underline">Edit this outline</Link>
      </div>
    </details>
  );
}
