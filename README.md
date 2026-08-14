# Mara & Terry — wedding website

Friday **11 June 2027**, Grohnder Fährhaus, Emmerthal-Grohnde.
Live at **https://maraterrywedding.github.io**

English, German and Brazilian Portuguese, from one set of source files.

```bash
npm install
npm run dev        # site on :4321
npm run dev:api    # mock RSVP backend on :8788, second terminal
```

Then open http://localhost:4321.

## What's here

| | |
|---|---|
| **Site** | Astro 5, static output, deployed to GitHub Pages by Actions |
| **RSVP backend** | Google Apps Script writing to a Google Sheet — see [`gas/SETUP.md`](gas/SETUP.md) |
| **Tests** | 287 unit (Vitest), 41 end-to-end and accessibility (Playwright) |

The keystone is [`src/lib/rsvp/validate.ts`](src/lib/rsvp/validate.ts): the
browser form, the Apps Script backend and the test suite all import it, so the
client and server cannot disagree about what a valid reply looks like.

## Changing things without touching code

| What | Where |
|---|---|
| Add a Q&A entry | Type `/addqa <question> \| <answer>` |
| Edit Q&A, hotels | `src/content/faq.json`, `src/content/hotels.json` |
| The day's plan | `src/data/schedule.ts` — `internal: true` hides a line from guests |
| Dress code choice | `CHOSEN_CODE` in `src/data/dresscode.ts` |
| Dates, address, album links | `src/data/event.ts` |
| RSVP deadlines, invite code | The **Config** tab of the spreadsheet — read on every request, no redeploy |

## Commands

```bash
npm run test           # unit tests
npm run test:e2e       # end-to-end + accessibility
npm run build          # static build into dist/
npm run build:gas      # bundle the backend into gas/dist/Code.gs
npm run fetch:climate  # refresh the June weather averages (needs internet)
node scripts/prep-photos.mjs             # after adding photos to resources/fotos/
node scripts/shot.mjs --full /           # screenshots into scratch/shots/
node scripts/smoke-rsvp.mjs <exec-url>   # check a live backend deployment
```

## Status

[`docs/PROGRESS.md`](docs/PROGRESS.md) — what's done, what's decided, what's
still needed. Session-by-session notes are in `docs/SESSION-*.md`.
