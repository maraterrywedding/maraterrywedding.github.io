# Session log — 14 August 2026, Block 5

**Session ID:** `e57d9812-7ef6-4333-b8a7-c707a86df50a`
**Saved at:** `docs/SESSION-2026-08-14-block5.md`

The RSVP backend is written and tested. **277 unit + 48 end-to-end tests green.**
What remains is about twenty minutes of clicking in Google's console —
[`gas/SETUP.md`](../gas/SETUP.md) walks through it.

---

## Shape

`gas/src/handlers.ts` holds every decision and knows nothing about Google. It
takes a `Deps` object — sheet, mailer, clock, uuid, lock — so Vitest can run the
whole backend against an in-memory sheet. `main.ts` is a thin adapter that binds
`SpreadsheetApp`, `MailApp`, `LockService` and `Utilities` to those ports.

It imports `src/lib/rsvp/validate.ts` — the very same module the browser form
uses. `scripts/build-gas.mjs` bundles it with esbuild into a single 42 KB
`Code.gs`. The client and the server therefore run byte-for-byte identical
validation, and it is impossible for one to accept what the other rejects.

## Decisions worth knowing

**Config is read on every request, never cached.** Moving a deadline, changing
the invitation code or fixing the site URL is one cell in the `Config` tab — no
redeploy, no rebuild, and no new `/exec` URL.

**The deadline is enforced here, not in the UI.** The form hides itself after
the hard lock, but that is cosmetic. A guest with the raw endpoint still cannot
write.

**Nothing is ever destroyed.** Every create and edit appends to a `Submissions`
tab. That is what answers "I definitely said vegan" in May, and it is why there
is no optimistic locking: if two people in a party save at once the later write
wins, but the earlier one is still sitting in the log rather than gone.

**Email failure never fails a submission.** The answer is already stored; losing
it because Gmail hiccuped would be far worse than a missing receipt. There is a
test for exactly this.

**A honeypot hit gets a success response.** A bot that is told it failed simply
tries again differently.

**Unknown and malformed tokens return the identical response**, so the endpoint
gives nothing away to someone guessing.

## Vendor hand-offs are redacted, and tested

`rebuildExports` (a **Wedding** menu in the sheet) regenerates four tabs on
demand rather than on every write — no guest waits for work only the couple look
at.

- `CateringHandoff` → **safe to send the caterer.** First names, age band, meal
  class, allergens. No surnames, no email, no phone, no messages.
- `HotelBlock` → **safe to send the Fährhaus.** Rooms, nights, cots. Nothing
  about what anybody eats.
- `CateringSummary` keeps the **day total and the evening total separate**,
  because they differ and the difference is money.

The privacy notice promises this redaction, so tests assert it — both that the
column names carry nothing forbidden and that the rendered rows contain no
surname, address or private message.

## The mock server was lying

Building the smoke test exposed it. `scripts/mock-rsvp-server.mjs` was a
hand-written stub that never validated a payload and never issued a party code.
The end-to-end suite had been passing against a **weaker contract than
production** — precisely the failure mode a mock is supposed to prevent.

It is now `scripts/mock-rsvp-server.ts` and imports the real handlers, running
them against an in-memory sheet. Node 24 executes TypeScript directly, so this
costs nothing. The e2e tests now exercise the actual backend logic.

Making that work needed explicit `.ts` extensions on the relative imports in
`gas/src/` and `src/lib/rsvp/`, because Node's native ESM resolver requires them
where esbuild and Vite do not. Noted in the files so nobody removes them.

The mock still rejects `application/json` and refuses to answer a CORS preflight,
so a client that gets the request shape wrong fails loudly and locally rather
than only in production.

## Two notes to self

`process.exit()` while fetch still holds sockets makes libuv print an alarming
assertion failure on Windows, directly after the script has said everything
passed. `process.exitCode` instead.

And, for the second time: **do not use PowerShell `Set-Content` on UTF-8 source
files.** It turned the em dash and the ä in `package.json` into mojibake. The
Edit tool handles encoding correctly.

## What you need to do

Follow [`gas/SETUP.md`](../gas/SETUP.md). The one thing to internalise, because
it is silent and expensive:

> After the first deployment, publish changes with
> **Deploy → Manage deployments → pencil → New version**.
> Never "New deployment" — that mints a *new* `/exec` URL, and every edit link
> already emailed to a guest points at the old one.

Then run `node scripts/smoke-rsvp.mjs <your /exec URL>` — 18 checks against the
live backend — and delete the test row it leaves behind.

## Where to pick up

**Block 6** — fill in any remaining German and Brazilian Portuguese strings
(`src/i18n/pending-translation.json` should end up empty), then an accessibility
and contrast pass.

**Block 7** — GitHub repo, Actions workflow, Pages. The repo name decides the
base path; `<username>.github.io` keeps it at `/` and avoids a class of
"works locally, 404s in production" bugs.
