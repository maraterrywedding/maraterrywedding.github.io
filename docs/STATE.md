# Where the project stands

**Last updated:** 14 August 2026
**Session ID:** `e57d9812-7ef6-4333-b8a7-c707a86df50a`
**Live at:** https://maraterrywedding.github.io

Built from an empty folder to a launched site in one session. This file is the
short version; [`PROGRESS.md`](PROGRESS.md) has the detail and the
`SESSION-*.md` files are a blow-by-blow record including every bug and why it
happened.

---

## What exists

A trilingual static site — English, German, Brazilian Portuguese — with nine
guest-facing pages, a five-step RSVP wizard, and a Google Apps Script backend
writing to a spreadsheet. **287 unit tests, 81 end-to-end and accessibility
tests, zero axe violations.**

| Page | |
|---|---|
| Home | Hero, live countdown, live weather plus 31-year June averages |
| The day | Full timeline; two vendor-logistics lines hidden from guests |
| Getting there | Five routes. Emmerthal is on the S5, direct from Hannover Airport |
| Where to stay | The venue plus four alternatives within 20 km |
| What to wear | Four-rung formality ladder with silhouettes, plus venue-specific advice |
| Questions | Twelve entries, no-JavaScript accordion, extended with `/addqa` |
| Photos | Both albums with build-time QR codes |
| Privacy / Imprint | Eight-section notice including the Article 9 explanation |
| RSVP | The wizard, plus an edit page reachable by link or party code |

## The two ideas worth preserving

**One validator, three consumers.** `src/lib/rsvp/validate.ts` is imported by
the browser form, bundled into the Apps Script backend, and exercised by Vitest.
The client and the server cannot disagree about what a valid reply is. This is
what made 92 validation tests affordable rather than a chore, and it is the thing
to protect if the code is ever refactored.

**Content is data, not markup.** Adding a question, a hotel, a schedule entry or
a translation is a data change. Templates stay untouched, and a test fails if a
translation goes missing without being declared pending.

## Live settings that are not in git

The spreadsheet's **Config** tab, read on every request:
`siteOrigin`, `replyTo`, `softDeadline`, `hardLock`, `eventAt`, `hotelNights`,
`inviteCode`, `coupleNames`. Changing a deadline is one cell — no redeploy, no
rebuild, no new `/exec` URL.

## Still open

None of it blocking.

- Ceremony time: 11:00 or 13:00 (`ceremonyTimeConfirmed` in `event.ts` drives the
  "to be confirmed" pill)
- Gift policy — the most-asked question, currently an honest "still deciding"
- Dress code choice — set `CHOSEN_CODE` and the page highlights it
- Party Photos album link
- WhatsApp number
- Verify the five alternative hotels: distances are estimates and four have no
  booking link
- Repo visibility (see `PROGRESS.md`)
- Permission from the Grohnder Fährhaus for their three photos, or replacements

## Diary note

The privacy notice promises **all guest data deleted by 30 September 2027**.
Honouring that means deleting the spreadsheet, emptying Drive's bin, and removing
the Apps Script deployment. Put it in a calendar.

## Bugs worth remembering

Recorded properly in the session logs, but these three were the instructive ones:

1. **A unit test that was right and useless.** It proved the language switcher
   preserved `?t=`, and passed always — but on a static page there is no query
   string at build time, so the links were built correctly from nothing. Only an
   end-to-end test caught it.
2. **Labels attached to nothing.** The attendee card's labels had no `for`/`id`
   pairing, because cloned cards cannot use ids. Every functional test passed;
   the form worked perfectly, for people who could see it.
3. **A 165px scrollbar from a 1px element.** A `position: absolute` helper inside
   a horizontal scroller isn't clipped by it, so seven invisible spans dragged
   the whole document sideways on every phone.

The pattern: passing tests are not the same as working software, and the gap is
usually somewhere nobody thought to look.
