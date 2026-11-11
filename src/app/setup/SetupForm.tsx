"use client";

import { useActionState } from "react";
import { setupAction } from "@/lib/actions/auth";

export function SetupForm() {
  const [error, action, pending] = useActionState(setupAction, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">
        <span className="label">Your name</span>
        <input name="name" required className="input" />
      </label>
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" required className="input" />
      </label>
      <label className="block">
        <span className="label">Password (8+ characters)</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={pending} className="btn-primary w-full">
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
