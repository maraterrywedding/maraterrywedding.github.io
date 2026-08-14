# Setting up the RSVP backend

One Google Sheet and one Apps Script. About twenty minutes, once.

**Two places are involved**, and mixing them up is the easiest mistake to make:

| | |
|---|---|
| 💻 **Your computer** | Terminal commands (`npm ...`), run in `C:\dev\bigday-wedding` |
| 🌐 **Google, in the browser** | The spreadsheet and the Apps Script editor |

Nothing starting with `npm` ever goes into the Apps Script editor. Each step
below is marked with which one it belongs to.

Everything runs under one Google account — **ruasterry@gmail.com**, or a
separate wedding-only account if you take that route (see the Advanced
Protection note in step 3). Be signed in as that account before you start, and
check the avatar in the top right at every step: with several accounts signed
in, Google quietly uses whichever it feels like.

---

## 1. Make the sheet

1. Go to [sheets.new](https://sheets.new).
2. Name it something you will recognise in two years: **Mara & Terry — RSVPs**.

That is all. The script creates every tab it needs the first time it runs.

## 2. Add the script

This step moves between two different places. **Watch the headings** — the
`npm` command belongs on your own machine and will not work anywhere else.

### 💻 On your computer

Open a terminal in `C:\dev\bigday-wedding` and run:

```bash
npm run build:gas
```

That writes **`gas/dist/Code.gs`**. Open that file in a text editor and copy all
of it (Ctrl+A, Ctrl+C).

> If the file is already there and up to date, you can skip the command and just
> open it. Rebuild whenever anything in `gas/src/` changes.
>
> `npm` is Node.js on your own machine. The Apps Script editor cannot run it,
> has never heard of it, and will refuse to save it — that is expected, not a
> fault.

### 🌐 In the Apps Script editor

1. Back in the sheet: **Extensions → Apps Script**. A new browser tab opens.
2. Name the project **Wedding RSVP** (top left).
3. Delete the `function myFunction() {}` that is sitting in the editor.
4. Paste what you copied (Ctrl+V). It is about 1,200 lines — that is correct.
5. Click the gear icon (**Project Settings**) in the left sidebar and tick
   **"Show appsscript.json manifest file in editor"**.
6. Return to the **Editor** (`<>` icon), open `appsscript.json` in the file list,
   and replace its contents with `gas/appsscript.json` from this repo.
7. Save (Ctrl+S). Both files should now show without an error.

> **Never edit the script inside the Google editor.** `Code.gs` is generated.
> Change the TypeScript in `gas/src/`, run `npm run build:gas` again, and paste
> again — otherwise your fix disappears the next time anyone rebuilds.

## 3. Authorise it

1. In the function dropdown at the top, choose **rebuildExports**, and click
   **Run**.
2. Google will ask for permission. **This screen looks alarming and that is
   normal** — the app is "unverified" because it is yours and has not been
   through Google's review, which is not a thing a private script needs.
   - Click **Review permissions**
   - Choose the ruasterry@gmail.com account
   - Click **Advanced**, then **Go to Wedding RSVP (unsafe)**
   - Click **Allow**
3. It will say "No responses yet." That is the correct answer, and it means the
   permissions are in place.

The script asks for four permissions: read and write *this* spreadsheet only,
send email as you, read your email address (to set the reply-to), and show a
menu. It cannot touch your other files or your inbox.

### If you get "not approved by Advanced Protection"

> **Access blocked: Wedding RSVP is not approved by Advanced Protection**
> Error 400: policy_enforced

This is not a fault in the script. Google's [Advanced Protection
Program](https://myaccount.google.com/advanced-protection) blocks *every* Apps
Script from running on the account — including scripts you wrote yourself —
because a script gets read and write access to your data. There is no allowlist,
and a consumer Gmail account has no admin console to grant an exception.

It blocks the whole script, not just the email part, so the spreadsheet writing
would not work either.

Two ways forward:

**Use a separate Google account for the wedding.** Recommended. It sidesteps the
programme entirely and leaves your main account's security alone. It is also
better data hygiene: guest names, phone numbers, children's ages and allergies
live somewhere other than your primary identity, and the promise to delete
everything by 30 September 2027 becomes as simple as deleting the account. Set
it to forward to your usual address so you never have to check it.

Then repeat this guide signed in as that account, and put its address in the
`replyTo` Config cell.

**Or opt out of Advanced Protection** at the link above, and retry step 3. Two
minutes — but it is a real security downgrade on your primary account. If you
enrolled deliberately, especially with a security key, prefer the separate
account.

Nothing in the code changes either way. The account only decides who owns the
sheet and what goes in `replyTo`.

## 4. Deploy it as a web app

1. **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set:
   - **Description**: `v1`
   - **Execute as**: **Me (ruasterry@gmail.com)**
   - **Who has access**: **Anyone**

   > It must be **Anyone**, not "Anyone with a Google account". Guests must not
   > have to sign in to Google to reply to a wedding invitation.
4. **Deploy**, then copy the **Web app URL**. It ends in `/exec`.

## 5. ⚠️ The one thing that breaks everything

**When you change the script later, never use "New deployment" again.**

Every new deployment gets a **new `/exec` URL**. The old one keeps working, but
the website points at whichever URL you last pasted into GitHub — and every edit
link you have already emailed to a guest points at the old one. Half your guests
end up on a dead form and you will not find out for weeks.

To publish a change, always:

**Deploy → Manage deployments → (pencil icon) → Version: New version → Deploy**

Same URL, new code. Make this a habit from the first change.

## 6. Fill in the Config tab

Go back to the sheet. There is now a **Config** tab. Set these:

| key | value |
|---|---|
| `softDeadline` | `2026-11-05T23:59:59+01:00` |
| `hardLock` | `2026-12-15T23:59:59+01:00` |
| `eventAt` | `2027-06-11T11:00:00+02:00` |
| `hotelNights` | `2027-06-10,2027-06-11,2027-06-12` |
| `inviteCode` | `GROHNDE27` |
| `siteOrigin` | **`https://maraterrywedding.github.io`** — see the warning below |
| `replyTo` | `ruasterry@gmail.com` |
| `coupleNames` | `Mara & Terry` |

**These are read on every single request.** Moving a deadline, changing the
invitation code or fixing the site URL is a one-cell edit — no redeploy, no
rebuild, and no new `/exec` URL.

> ⚠️ **`siteOrigin` is the one that bites.** It defaults to
> `http://localhost:4321`, and every confirmation email builds its edit link
> from it. Leave it at the default and guests receive a link to *your laptop* —
> the reply is stored perfectly, the email arrives looking correct, and nothing
> appears wrong until somebody tries to change their answer and cannot.
>
> `scripts/smoke-rsvp.mjs` now fails if this is still pointing at localhost.

Note the `+01:00` and `+02:00`: Germany is on winter time in November and
December, summer time in June. Getting these wrong shifts a deadline by an hour,
which matters only at midnight — but it is free to get right.

## 7. Point the website at it

Paste the `/exec` URL into `PUBLIC_RSVP_ENDPOINT`:

- **Locally**: create a `.env` file with `PUBLIC_RSVP_ENDPOINT=https://...` 
- **On GitHub**: Settings → Secrets and variables → Actions → **Variables** →
  New repository variable

Use a **variable**, not a secret. The URL ends up in the page source either way,
so treating it as a secret only gives false comfort. What actually protects the
form is the server-side deadline check, the honeypot field and the invitation
code — all of which live in the script, not in the URL.

## 8. Check it works

```bash
node scripts/smoke-rsvp.mjs https://script.google.com/macros/s/XXXX/exec
```

That sends a real test submission, reads it back, updates it, and confirms the
deadline is enforced. Then delete the test row from the sheet.

Finally, do one submission through the actual website with your own email and
click the link in the confirmation. Scopes, deployment settings and CORS can
only really fail for real.

---

## Living with it

**The tabs**

| Tab | What it is |
|---|---|
| `Responses` | One row per reply. This is your working list. |
| `Submissions` | Append-only log of every version ever saved. Never edit this — it is what answers "I definitely said vegan" in May. |
| `Config` | The settings above. |
| `Attendees`, `CateringSummary`, `HotelBlock`, `CateringHandoff` | Generated. See below. |

**Two columns worth scanning**

- `codeValid` — says `NO CODE` when someone could not produce a valid invitation
  code. They were let through on purpose; check who they are.
- `possibleDuplicate` — says `CHECK` when a name also appears in another party.
  Usually two relatives with the same name; occasionally a genuine double entry.

**Rebuilding the exports**

**Wedding → Rebuild exports** in the sheet's menu bar. (If the menu is missing,
reload the sheet.) It regenerates four tabs:

- `Attendees` — one row per person with the derived catering fields
- `CateringSummary` — the kitchen one-pager, with the **day total and the
  evening total kept separate**, because they differ and the difference is money
- `HotelBlock` — **safe to send to the Fährhaus.** Rooms and nights, no diets
- `CateringHandoff` — **safe to send to the caterer.** First names and meals
  only, no surnames, no contact details

Those last two are redacted deliberately, and there are tests asserting the
redaction holds. `Responses` and `Attendees` are for the two of you only — do
not forward them to a vendor.

Rebuild before you talk to a vendor, not on a schedule; it is generated fresh
from `Responses` every time.

**Email limits**

A consumer Gmail account sends 100 emails a day. A wedding sends maybe 150 in
total, spread over months, so this will not bite. If you ever do hit it,
submissions still save — only the confirmation email is skipped, and the guest
sees their link on screen regardless.

**Deleting the data**

The privacy notice promises everything is deleted by **30 September 2027**. That
means actually deleting this spreadsheet, emptying it from Drive's bin, and
removing the deployment. Put it in a calendar now.
