"use client";

import { useActionState } from "react";
import { importBookAction } from "@/lib/actions/library";

export function UploadBookForm() {
  const [msg, action, pending] = useActionState(importBookAction, null);
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="label">Book file (EPUB)</span>
        <input name="file" type="file" required accept=".epub,application/epub+zip" className="input file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-1 file:text-sm" />
      </label>
      {msg && <p className="text-sm text-red-700">{msg}</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Reading the book…" : "Add book"}</button>
      <p className="text-xs text-stone-500">Use a copy you own. It is stored only in this CRM, behind your login, for your own reference.</p>
    </form>
  );
}
