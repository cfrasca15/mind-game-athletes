"use client";

import { useActionState, useState } from "react";
import {
  connectGoogleAction,
  disconnectGoogleAction,
  setGoogleNameStyleAction,
  syncGoogleNowAction,
} from "@/lib/actions/google";
import { ConfirmButton } from "@/components/ConfirmButton";

export type GoogleStatus = {
  clientEmail: string;
  calendarId: string;
  fullNames: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  onCalendar: number;
  waiting: number;
  failed: number;
} | null;

export function GoogleCalendarCard({ status }: { status: GoogleStatus }) {
  return (
    <section className="card">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-semibold text-stone-900">Google Calendar</h2>
        {status && <span className="pill bg-emerald-50 text-emerald-700">Connected</span>}
      </div>
      <p className="mb-4 text-sm text-stone-500">
        Sessions you book here show up on your Google Calendar. Change or cancel a session here and the calendar follows. Edits made in Google Calendar do not come back here.
      </p>
      {status ? <Connected status={status} /> : <Connect />}
    </section>
  );
}

function Connect() {
  const [msg, action, pending] = useActionState(connectGoogleAction, null);
  // Controlled, so a failed attempt does not wipe what was pasted.
  const [calendarId, setCalendarId] = useState("");
  const [key, setKey] = useState("");
  return (
    <>
      <details className="mb-4 rounded-lg border border-stone-200 p-3 text-sm text-stone-700">
        <summary className="cursor-pointer font-medium text-emerald-800">How to set this up (about 10 minutes, once)</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>In Google Calendar on a computer, create a new calendar called <b>Mind Game Athletes</b>: next to &ldquo;Other calendars&rdquo; click <b>+</b>, then <b>Create new calendar</b>.</li>
          <li>Go to <b>console.cloud.google.com</b>, sign in with a personal Gmail account, and create a project (any name).</li>
          <li>In the search bar at the top, find <b>Google Calendar API</b> and click <b>Enable</b>.</li>
          <li>Open <b>IAM &amp; Admin</b>, then <b>Service Accounts</b>, then <b>Create service account</b>. Give it a name such as <b>mga-crm</b> and click <b>Done</b>. Skip the optional steps.</li>
          <li>Click the new service account, open the <b>Keys</b> tab, choose <b>Add key</b>, <b>Create new key</b>, <b>JSON</b>. A file downloads. Keep it private.</li>
          <li>Copy the service account&rsquo;s email address (it ends in <b>iam.gserviceaccount.com</b>). Back in Google Calendar, open the new calendar&rsquo;s <b>Settings and sharing</b>, and under <b>Share with specific people</b> add that address with <b>Make changes to events</b>.</li>
          <li>On the same page, scroll to <b>Integrate calendar</b> and copy the <b>Calendar ID</b>.</li>
          <li>Paste the Calendar ID below. Open the downloaded file in Notepad, copy everything, and paste it into the key box.</li>
        </ol>
      </details>
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
        {msg && <p className="text-sm text-stone-700">{msg}</p>}
        <button disabled={pending} className="btn-primary">{pending ? "Testing the connection…" : "Connect and test"}</button>
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

function Connected({ status }: { status: NonNullable<GoogleStatus> }) {
  const [syncMsg, syncAction, syncPending] = useActionState(syncGoogleNowAction, null);
  const [nameMsg, nameAction, namePending] = useActionState(setGoogleNameStyleAction, null);
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
        <dt className="text-stone-500">Calendar</dt>
        <dd className="break-all text-stone-800">{status.calendarId}</dd>
        <dt className="text-stone-500">Shared with</dt>
        <dd className="break-all text-stone-800">{status.clientEmail}</dd>
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

      <div className="border-t border-stone-100 pt-4">
        <ConfirmButton action={disconnectGoogleAction} message="Stop sending sessions to Google Calendar? Events already on the calendar stay there.">Disconnect</ConfirmButton>
      </div>
    </div>
  );
}
