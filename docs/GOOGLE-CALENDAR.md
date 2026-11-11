# Google Calendar sync

Sessions booked in the CRM are mirrored onto a Google Calendar. It is one-way:
the CRM is the source of truth and nothing is read back from Google.

| In the CRM | On Google Calendar |
| --- | --- |
| Schedule a session | Event is created |
| Change time, length, type or location | Event is updated |
| Mark cancelled, or delete the session | Event is removed |
| Reopen a cancelled session | Event is created again |
| Mark no-show | Event stays, title becomes "No-show: …" |
| Rename a player or team | Upcoming event titles are updated |

Events carry only who, when and where: `Session: Maya A.`, the time, the
location, and a link back to the session. The session title, plan and notes are
never sent. Full names can be turned on in Settings.

If Google cannot be reached, the session still saves. The session page shows a
warning with a **Try again** button, and **Sync now** in Settings retries
everything.

## Connecting

In the CRM go to **Settings → Google Calendar** and click **Connect Google
Calendar**. Google asks you to sign in and to let the CRM add events. Leave the
calendar box ticked and continue. The CRM adds and removes a test event to
prove it can write, then pushes every upcoming session.

Sessions go on the main calendar of the account that signed in. To keep them
apart from personal events, make a calendar just for them in Google Calendar
and paste its Calendar ID under **Use a different calendar**.

Open the CRM at the same address as `GOOGLE_REDIRECT_URI` (below) when you do
this. Google sends the browser back to that address, and your CRM login only
counts there.

## One-time server setup

The button needs a Google Cloud "OAuth client", the same thing medicare-crm
uses. Both CRMs can share one client: each just needs its own redirect address
listed on it.

1. Open <https://console.cloud.google.com>, pick the project, and go to
   **APIs & Services → Credentials** (called **Google Auth Platform → Clients**
   in the newer layout). Open the existing OAuth client, or create one of type
   **Web application**.
2. Under **Authorized redirect URIs** add this CRM's address followed by
   `/api/google/callback`, for example
   `http://your-server.tailXXXX.ts.net:3001/api/google/callback`. Google needs
   a real hostname here. A bare IP such as `192.168.1.50` is refused. Save.
3. Make sure the **Google Calendar API** is enabled in the same project.
4. On the server, add three lines to `docker.env`:

   ```
   GOOGLE_CLIENT_ID="…apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="…"
   GOOGLE_REDIRECT_URI="http://your-server.tailXXXX.ts.net:3001/api/google/callback"
   ```

   The redirect line must match step 2 exactly.
5. Restart so the container picks them up: `docker compose up -d`.

The Connect button appears in Settings once all three values are present.

### Who is allowed to sign in

That is decided by the project's consent screen (**Audience**), not by the CRM:

| Audience setting | Who can sign in | Stays signed in |
| --- | --- | --- |
| Internal | Only accounts in your Google Workspace organization | Yes |
| External, Testing | Only the test users you list | No. Google ends it after 7 days |
| External, In production | Any Google account, after a "Google hasn't verified this app" warning | Yes |

If her account is not allowed to sign in, there are two ways around it that
need no changes in Google Cloud:

- Sign in with an account that is allowed. In Google Calendar, have her share
  her calendar with that account with **Make changes to events**. Then paste
  her calendar's ID under **Use a different calendar**.
- Use the service account method below.

## Things to know

- **The sign-in is stored in the CRM database.** Database backups therefore
  contain it. If a backup leaks, remove the CRM's access at
  <https://myaccount.google.com/permissions> and connect again. If the same
  Google account is also connected to medicare-crm through the same client,
  removing access there disconnects both, so reconnect both.
- **Disconnect** stops the sync and forgets the sign-in. It does not remove the
  access on Google's side, for the reason above.
- **Edits made in Google are overwritten.** The next time the session is saved
  in the CRM, or Sync now is pressed, the event goes back to what the CRM says.
  An event deleted in Google is put back.
- **Changing calendars** moves upcoming sessions to the new calendar. Past
  events stay where they were.

## The other way: a service account

This needs no sign-in and never expires, but takes about 10 minutes. The CRM
signs in as a "service account", a robot login that can only touch calendars
shared with it. In Settings it is under **Another way to connect, without
signing in**.

1. **Make the calendar.** In Google Calendar on a computer, next to "Other
   calendars" click **+**, then **Create new calendar**. Name it
   *Mind Game Athletes*.
2. **Make a Google Cloud project.** Go to <https://console.cloud.google.com>,
   sign in, and create a project (any name). A personal `@gmail.com` account
   is easiest: Workspace organizations often block step 5.
3. **Turn on the Calendar API.** Search for *Google Calendar API* in the top
   search bar and click **Enable**.
4. **Create the service account.** Open **IAM & Admin → Service Accounts →
   Create service account**. Name it `mga-crm`, click **Done**, and skip the
   optional steps.
5. **Download its key.** Click the service account, open **Keys → Add key →
   Create new key → JSON**. A `.json` file downloads. Treat it like a password.
6. **Share the calendar with it.** Copy the service account's email address
   (ends in `iam.gserviceaccount.com`). In Google Calendar open the new
   calendar's **Settings and sharing**, and under **Share with specific
   people** add that address with **Make changes to events**.
7. **Copy the Calendar ID.** Same page, under **Integrate calendar**. It looks
   like `abc123…@group.calendar.google.com`.
8. **Connect.** Paste the Calendar ID, open the downloaded file in Notepad and
   paste all of it into the key box, then click **Connect and test**.

After connecting, delete the downloaded `.json` file. The CRM keeps its own
copy in its database.

## What the error messages mean

| Message | Fix |
| --- | --- |
| Google needs you to sign in again | The sign-in expired or access was removed. Click **Sign in again** in Settings. If this happens every week, the project is in Testing (see the table above). |
| Google was not given permission to add events | The calendar box was unticked on Google's screen. Sign in again and leave it ticked. |
| To connect Google, open the CRM at … | The CRM was opened through a different address than `GOOGLE_REDIRECT_URI`. Use the address shown. |
| Google did not accept the client ID and secret | `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` in `docker.env` is wrong. |
| Google shows "redirect_uri_mismatch" | The address in `GOOGLE_REDIRECT_URI` is not listed on the OAuth client (server setup, step 2). |
| Google shows "Access blocked" | That account is not allowed by the consent screen. See "Who is allowed to sign in". |
| Google could not find that calendar | Wrong Calendar ID, or the calendar is not shared with the account that is connected. |
| The Google account that is signed in cannot change that calendar | It is shared as view-only. Change it to "Make changes to events". |
| The Google Calendar API is not turned on | Enable it in the same Google Cloud project as the OAuth client or service account. |
| Google rejected the key | Service account only: the key was deleted in Google Cloud. Create a new one. |
| Could not reach Google | The server has no internet access right now. |
