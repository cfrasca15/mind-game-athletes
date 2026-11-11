# Google Calendar sync

Sessions booked in the CRM are mirrored onto one Google Calendar. It is one-way:
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

## One-time setup (about 10 minutes)

The CRM signs in to Google as a "service account", a robot login that can only
touch calendars shared with it.

1. **Make the calendar.** In Google Calendar on a computer, next to "Other
   calendars" click **+**, then **Create new calendar**. Name it
   *Mind Game Athletes*. A separate calendar keeps the robot away from personal
   events and gives sessions their own color.
2. **Make a Google Cloud project.** Go to <https://console.cloud.google.com>,
   sign in, and create a project (any name). Use a personal `@gmail.com`
   account for this step. See the note on Workspace accounts below.
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
8. **Connect.** In the CRM go to **Settings → Google Calendar**, paste the
   Calendar ID, open the downloaded file in Notepad and paste all of it into
   the key box, then click **Connect and test**. The CRM adds and removes a
   test event to prove it can write, then pushes every upcoming session.

After connecting, delete the downloaded `.json` file. The CRM keeps its own
copy.

## Things to know

- **Workspace accounts.** Google Workspace organizations often block creating
  service account keys (step 5 shows a policy error) and may limit calendar
  sharing outside the organization. Doing steps 2 to 5 with a personal Gmail
  account avoids the first problem. The calendar itself can live in either kind
  of account, as long as step 6 lets you choose "Make changes to events".
- **The key is stored in the CRM database.** Database backups therefore contain
  it. If a backup leaks, delete the key in Google Cloud (Keys tab) and connect
  again with a new one.
- **Changing calendars.** Disconnect, then connect with the new Calendar ID.
  Events on the old calendar are left in place.
- **Edits made in Google are overwritten.** The next time the session is saved
  in the CRM, or Sync now is pressed, the event goes back to what the CRM says.
  An event deleted in Google is put back.

## What the error messages mean

| Message | Fix |
| --- | --- |
| Google could not find that calendar | Wrong Calendar ID, or the calendar is not shared with the service account (step 6). |
| Google would not allow changes to that calendar | It is shared as view-only. Change it to "Make changes to events". |
| The Google Calendar API is not turned on | Step 3 was skipped, or was done in a different project. |
| Google rejected the key | The key was deleted in Google Cloud. Create a new one (step 5). |
| Could not reach Google | The server has no internet access right now. |
