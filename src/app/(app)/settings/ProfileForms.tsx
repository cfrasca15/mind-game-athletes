"use client";

import { useActionState } from "react";
import { changePasswordAction, updateProfileAction } from "@/lib/actions/auth";

export function ProfileForms({ name, email }: { name: string; email: string }) {
  const [profileMsg, profileAction, profilePending] = useActionState(updateProfileAction, null);
  const [pwMsg, pwAction, pwPending] = useActionState(changePasswordAction, null);
  return (
    <>
      <section className="card">
        <h2 className="mb-3 font-semibold text-stone-900">Your profile</h2>
        <form action={profileAction} className="space-y-3">
          <label className="block"><span className="label">Name</span><input name="name" defaultValue={name} required className="input" /></label>
          <label className="block"><span className="label">Email (used to sign in)</span><input name="email" type="email" defaultValue={email} required className="input" /></label>
          {profileMsg && <p className="text-sm text-stone-600">{profileMsg}</p>}
          <button disabled={profilePending} className="btn-primary">Save</button>
        </form>
      </section>
      <section className="card">
        <h2 className="mb-3 font-semibold text-stone-900">Change password</h2>
        <form action={pwAction} className="space-y-3">
          <label className="block"><span className="label">Current password</span><input name="current" type="password" required autoComplete="current-password" className="input" /></label>
          <label className="block"><span className="label">New password (8+)</span><input name="next" type="password" required minLength={8} autoComplete="new-password" className="input" /></label>
          {pwMsg && <p className="text-sm text-stone-600">{pwMsg}</p>}
          <button disabled={pwPending} className="btn-primary">Update password</button>
        </form>
      </section>
    </>
  );
}
