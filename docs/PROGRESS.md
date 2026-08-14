# Progress — Mara & Terry wedding site

Living status board. Update at the end of every working session.
Detailed session notes live alongside this file as `SESSION-<date>.md`.

## Blocks

| # | Block | Status | Notes |
|---|---|---|---|
| 1 | Foundation — Astro, tokens, i18n, layout | ✅ Done | Builds in 3 languages |
| 1b | Photo processing | ✅ Done | 29 MB → 5.1 MB sources, EXIF/GPS stripped |
| 2 | Static content pages + `/addqa` skill | ✅ Done | 28 pages, fully trilingual |
| 3 | Countdown + weather islands | ✅ Done | Live weather + 31-year June normals |
| 4 | RSVP wizard (client side) | ✅ Done | 234 unit + 48 e2e tests green; invitation-code gate, works offline against the mock backend |
| 5 | Apps Script backend + Sheet | ✅ **Deployed & smoke-tested** | Live on a wedding-only Google account, 14 Aug 2026 |
| 6 | Translation fill-in + a11y polish | ✅ Done | Zero axe violations across 10 pages × 2 viewports; `pending-translation.json` empty |
| 7 | GitHub repo, Actions, Pages launch | ⬜ Not started | Repo name decides the base path |

## Decisions locked

| | |
|---|---|
| Couple | Mara & Terry |
| Date | Friday 11 June 2027, 11:00 Europe/Berlin — **time not final**, may move to 13:00 |
| Venue | Grohnder Fährhaus, Grohnder Fähre 1, 31860 Emmerthal-Grohnde |
| Couple arrive | 10 June 2027 (advertised to guests) |
| RSVP soft deadline | 5 November 2026 — early headcount, form stays open |
| RSVP hard lock | 15 December 2026 — form goes read-only |
| Backend | Google Apps Script + Google Sheet |
| Contact | ruasterry@gmail.com |
| Entry code | **None.** Nothing is printed on the invitations, so the form opens directly. Setting `EVENT.rsvp.inviteCode` turns the gate back on if that ever changes. |
| Party code | `MT-XXXXXX`, generated per party when they reply. Shown on the success screen and in the confirmation email. Gets a guest back into their answer (**with** the email address it was issued to), and is the couple's reference for seating and check-in. |
| Site URL | `https://maraterrywedding.github.io` — repo `maraterrywedding.github.io` under the account of the same name, so `base` stays `/` |
| Privacy | Public site with `noindex`; guest data private in the Sheet |
| Party rules | Open — guests add up to 8 people themselves |
| Hotel | Collect intent only; couple book later |
| Languages | English (default), German, Brazilian Portuguese |
| Stack | Astro 5 static → GitHub Pages |

Both RSVP dates are estimates and will move once vendors send formal proposals.
They live in one place (`src/data/event.ts`, later a `Config` tab in the Sheet)
precisely so moving them is a one-line change.

## Still needed from the couple

None of these block development.

- [ ] Ceremony time: 11:00 or 13:00
- [ ] Gift / wishlist policy — the single most-asked Q&A question. Currently on the
      Q&A page as an honest "we're still thinking about it"
- [ ] Dress code choice. Set `CHOSEN_CODE` in `src/data/dresscode.ts` and the page
      highlights it automatically
- [x] Memories album link — set 14 Aug 2026, QR code generating
- [ ] Party Photos album link (`EVENT.albums.party`) — page shows a waiting state
      until it exists
- [x] Contact email — set to ruasterry@gmail.com on 14 Aug 2026
- [ ] WhatsApp number for `EVENT.contact.whatsapp` (still empty)
- [ ] Confirm the invitation code before the invitations go to print. Changing it
      later means reprinting, and anyone holding an old card gets let through
      flagged rather than blocked — recoverable, but messy.
- [ ] Verify the five alternative hotels: distances are estimates, and four of the
      five have no booking link yet
- [ ] Confirm the venue's exact map coordinates (currently 52.028, 9.415)
- [ ] Whether a printed invite code should gate the RSVP endpoint — the only real
      spam defence on an anonymous public endpoint
- [ ] GitHub repo name. A repo called `<username>.github.io` keeps the base path
      at `/` and avoids a class of "works locally, 404s in production" bugs.
- [ ] Permission from the Grohnder Fährhaus to use the three photos taken from
      their website, or replacements shot on a site visit

## Editing content without touching code

| What | Where |
|---|---|
| Add a Q&A entry | Type `/addqa <question> | <answer>` — translates and verifies for you |
| Edit a Q&A entry | `src/content/faq.json` |
| Add or edit a hotel | `src/content/hotels.json` |
| Change the day's plan | `src/data/schedule.ts` — `internal: true` hides a line from guests |
| Pick the dress code | `CHOSEN_CODE` in `src/data/dresscode.ts` |
| Travel routes | `src/data/travel.ts` |
| Dates, times, address, album links | `src/data/event.ts` |
| Refresh the June weather averages | `npm run fetch:climate` (needs internet; only worth re-running every few years) |

`status` on a Q&A or hotel entry controls visibility: `final` shows it plainly,
`provisional` adds a "may still change" pill, `draft` hides it from the site.

## Commands

```bash
npm run dev            # dev server on :4321
npm run dev:api        # mock RSVP backend on :8788 (second terminal)
npm run build:gas      # bundle the backend into gas/dist/Code.gs
npm run build          # static build into dist/
npm run test           # Vitest unit suite (277)
npm run test:e2e       # Playwright — RSVP flows + accessibility (79)
node scripts/shot.mjs --full /   # screenshots to scratch/shots/
node scripts/prep-photos.mjs     # re-run after adding photos to resources/fotos/
```

To try the RSVP form locally, run `npm run dev` and `npm run dev:api` side by
side. Submissions are held in memory and print an edit link to the mock
server's console; restarting it clears everything.
