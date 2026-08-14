# Wedding website

A small trilingual static site — English, German and Brazilian Portuguese —
with an RSVP form, built from one set of source files.

```bash
npm install
npm run dev        # site on :4321
npm run dev:api    # mock RSVP backend on :8788, second terminal
```

Then open http://localhost:4321.

## How it fits together

| | |
|---|---|
| **Site** | Astro 5, static output, deployed by GitHub Actions |
| **RSVP backend** | Google Apps Script writing to a Google Sheet — see [`gas/SETUP.md`](gas/SETUP.md) |
| **Tests** | 287 unit (Vitest), 41 end-to-end and accessibility (Playwright) |

The keystone is [`src/lib/rsvp/validate.ts`](src/lib/rsvp/validate.ts). The
browser form, the Apps Script backend and the test suite all import it, so the
client and the server cannot disagree about what a valid reply looks like.

A few other decisions worth knowing before changing things:

- **Content is data, not markup.** Adding a question, a hotel or a schedule
  entry is a data change; the templates stay untouched.
- **Every translatable field carries all three languages inline**, with `null`
  meaning "not translated yet" — which renders the English and marks it up as
  such. A test fails if a key goes missing without being declared pending.
- **Guest replies live only in the spreadsheet.** Nothing submitted is ever
  rendered into the site, and no guest data is in this repository.
- **Photos are stripped of EXIF** before they reach `src/assets/`. The
  originals are deliberately not committed — they still carry location
  metadata.

## Changing content without touching code

| What | Where |
|---|---|
| Add a Q&A entry | Type `/addqa <question> \| <answer>` |
| Edit Q&A, accommodation | `src/content/faq.json`, `src/content/hotels.json` |
| The day's plan | `src/data/schedule.ts` — `internal: true` hides a line from guests |
| Dress code | `CHOSEN_CODE` in `src/data/dresscode.ts` |
| Dates, venue, album links | `src/data/event.ts` |
| RSVP deadlines | The **Config** tab of the spreadsheet — read on every request, no redeploy |

## Commands

```bash
npm run test           # unit tests
npm run test:e2e       # end-to-end + accessibility
npm run build          # static build into dist/
npm run build:gas      # bundle the backend into gas/dist/Code.gs
npm run fetch:climate  # refresh the June weather averages (needs internet)
node scripts/prep-photos.mjs             # after adding photos
node scripts/shot.mjs --full /           # screenshots into scratch/shots/
node scripts/smoke-rsvp.mjs <exec-url>   # check a live backend deployment
```

## Status

[`docs/PROGRESS.md`](docs/PROGRESS.md) — what is done, what is decided, what is
still needed. Session notes are in `docs/SESSION-*.md`.
