"use client";

import { useActionState, useState } from "react";
import {
  connectGoogleAction,
  disconnectGoogleAction,
  setGoogleCalendarAction,
  setGoogleNameStyleAction,
  syncGoogleNowAction,
} from "@/lib/actions/google";
import { ConfirmButton } from "@/components/ConfirmButton";

export type GoogleStatus = {
  /** True when she signed in with Google, false for a service account key. */
  signedIn: boolean;
  account: string | null;
  mainCalendar: boolean;
  calendarId: string;
  fullNames: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  onCalendar: number;
  waiting: number;
  failed: number;
} | null;

export type GoogleNotice = { ok: boolean; text: string } | null;

// A plain link, not next/link: this address starts the trip to Google and must not be preloaded.
const SIGN_IN = "/api/google/connect";

export function GoogleCalendarCard({ status, canSignIn, notice }: { status: GoogleStatus; canSignIn: boolean; notice: GoogleNotice }) {
  return (
    <section className="card">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-semibold text-stone-900">Google Calendar</h2>
        {status && <span className="pill bg-brand-50 text-brand-700">Connected</span>}
      </div>
      <p className="mb-4 text-sm text-stone-500">
        Sessions you book here show up on your Google Calendar. Change or cancel a session here and the calendar follows. Edits made in Google Calendar do not come back here.
      </p>
      {notice && (
        <p className={`mb-4 rounded-lg border p-3 text-sm ${notice.ok ? "border-brand-200 bg-brand-50 text-brand-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {notice.text}
        </p>
      )}
      {status ? <Connected status={status} canSignIn={canSignIn} /> : <NotConnected canSignIn={canSignIn} />}
    </section>
  );
}

function NotConnected({ canSignIn }: { canSignIn: boolean }) {
  return (
    <div className="space-y-4 text-sm">
      {canSignIn ? (
        <div className="space-y-2">
          <a href={SIGN_IN} className="btn-primary">Connect Google Calendar</a>
          <p className="text-stone-600">
            Google will ask you to sign in and to let this CRM add events. Sessions go on your main calendar, and you can choose a different one afterwards.
          </p>
        </div>
      ) : (
        <p className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-stone-700">
          Signing in with Google has not been switched on for this server yet. It needs three values added to the server&rsquo;s settings file. The steps are in <b>docs/GOOGLE-CALENDAR.md</b>.
        </p>
      )}
      <details className="rounded-lg border border-stone-200 p-3 text-stone-700">
        <summary className="font-medium text-stone-600">Another way to connect, without signing in</summary>
        <div className="mt-3">
          <ServiceAccountForm />
        </div>
      </details>
    </div>
  );
}

function ServiceAccountForm() {
  const [msg, action, pending] = useActionState(connectGoogleAction, null);
  // Controlled, so a failed attempt does not wipe what was pasted.
  const [calendarId, setCalendarId] = useState("");
  const [key, setKey] = useState("");
  return (
    <>
      <p className="mb-3 text-stone-600">
        This uses a &ldquo;service account&rdquo;, a robot login made in Google Cloud that can only touch a calendar you share with it. It takes about 10 minutes and the steps are in <b>docs/GOOGLE-CALENDAR.md</b>.
      </p>
      <form action={action} className="space-y-3">
        <label className="block">
          <span className="label">Calendar ID</span>
          <input name="calendarId" required value={calendarId} onChange={(e) => setCalendarId(e.target.value)} className="input" placeholder="abc123…@group.calendar.google.com" autoComplete="off" spellCheck={false} />
        </label>
        <label className="block">
          <span className="label">Key file contents</span>
          <textarea name="key" required value={key} onChange={(e) => setKey(e.target.value)} rows={5} className="input font-mono text-xs" placeholder={'{ "type": "service_account", … }'} autoComplete="off" spellCheck={false} />
        </label>
        <NameStyle defaultChecked={false} />
        {msg && <p className="text-stone-700">{msg}</p>}
        <button disabled={pending} className="btn">{pending ? "Testing the connection…" : "Connect and test"}</button>
      </form>
    </>
  );
}

function NameStyle({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name="fullNames" defaultChecked={defaultChecked} className="mt-1" />
      <span>
        Show full names on events
        <span className="block text-xs text-stone-500">Off: &ldquo;Session: Maya A.&rdquo; On: &ldquo;Session: Maya Alvarez&rdquo;. Notes and plans are never sent to Google.</span>
      </span>
    </label>
  );
}

function Connected({ status, canSignIn }: { status: NonNullable<GoogleStatus>; canSignIn: boolean }) {
  const [syncMsg, syncAction, syncPending] = useActionState(syncGoogleNowAction, null);
  const [nameMsg, nameAction, namePending] = useActionState(setGoogleNameStyleAction, null);
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
        {status.signedIn && (
          <>
            <dt className="text-stone-500">Signed in as</dt>
            <dd className="break-all text-stone-800">{status.account ?? "Your Google account"}</dd>
          </>
        )}
        <dt className="text-stone-500">Calendar</dt>
        <dd className="break-all text-stone-800">{status.mainCalendar ? "Your main calendar" : status.calendarId}</dd>
        {!status.signedIn && (
          <>
            <dt className="text-stone-500">Shared with</dt>
            <dd className="break-all text-stone-800">{status.account}</dd>
          </>
        )}
        <dt className="text-stone-500">Upcoming sessions</dt>
        <dd className="text-stone-800">
          {status.onCalendar} on the calendar
          {status.waiting > 0 && <span className="text-amber-700">, {status.waiting} not yet</span>}
        </dd>
        <dt className="text-stone-500">Last synced</dt>
        <dd className="text-stone-800">{status.lastSyncAt ?? "Not yet"}</dd>
      </dl>

      {status.lastError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <span className="font-medium">Last problem{status.lastErrorAt ? ` (${status.lastErrorAt})` : ""}:</span> {status.lastError}
        </div>
      )}

      <form action={syncAction} className="flex flex-wrap items-center gap-3">
        <button disabled={syncPending} className="btn">{syncPending ? "Syncing…" : "Sync now"}</button>
        <span className="text-stone-600">{syncMsg ?? "Pushes every upcoming session again and retries any that failed."}</span>
      </form>

      <form action={nameAction} className="space-y-2 border-t border-stone-100 pt-4">
        <NameStyle defaultChecked={status.fullNames} />
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={namePending} className="btn">{namePending ? "Saving…" : "Save"}</button>
          {nameMsg && <span className="text-stone-600">{nameMsg}</span>}
        </div>
      </form>

      {status.signedIn && <OtherCalendar status={status} />}

      <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 pt-4">
        {status.signedIn && canSignIn && <a href={SIGN_IN} className="btn">Sign in again</a>}
        <ConfirmButton action={disconnectGoogleAction} message="Stop sending sessions to Google Calendar? Events already on the calendar stay there.">Disconnect</ConfirmButton>
      </div>
    </div>
  );
}

/** Lets her send sessions to a separate calendar instead of her main one. */
function OtherCalendar({ status }: { status: NonNullable<GoogleStatus> }) {
  const [msg, action, pending] = useActionState(setGoogleCalendarAction, null);
  // Controlled, so a failed attempt does not wipe what was pasted.
  const [calendarId, setCalendarId] = useState(status.mainCalendar ? "" : status.calendarId);
  return (
    <details className="border-t border-stone-100 pt-4">
      <summary className="font-medium text-stone-600">Use a different calendar</summary>
      <form action={action} className="mt-3 space-y-3">
        <p className="text-stone-600">
          To keep sessions apart from personal events, make a calendar in Google Calendar just for them. Open its <b>Settings and sharing</b>, scroll to <b>Integrate calendar</b>, and paste the <b>Calendar ID</b> here. Leave the box empty to use your main calendar. Upcoming sessions move to the calendar you choose.
        </p>
        <label className="block">
          <span className="label">Calendar ID</span>
          <input name="calendarId" value={calendarId} onChange={(e) => setCalendarId(e.target.value)} className="input" placeholder="Empty means your main calendar" autoComplete="off" spellCheck={false} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={pending} className="btn">{pending ? "Checking the calendar…" : "Save"}</button>
          {msg && <span className="text-stone-600">{msg}</span>}
        </div>
      </form>
    </details>
  );
}
