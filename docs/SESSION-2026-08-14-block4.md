# Session log — 14 August 2026, Block 4

**Session ID:** `e57d9812-7ef6-4333-b8a7-c707a86df50a`
**Saved at:** `docs/SESSION-2026-08-14-block4.md`
**Previous:** `docs/SESSION-2026-08-14-block3.md`

The RSVP wizard works end to end against a local backend.
**223 unit tests + 36 end-to-end tests green.**

---

## The keystone

`src/lib/rsvp/validate.ts` is pure, dependency-free ESM with 92 tests of its
own. It is imported by the browser form, will be bundled into the Apps Script
backend in Block 5, and is exercised directly by Vitest. One implementation,
three consumers — the client and server cannot drift apart about what a valid
submission is.

Errors are returned as i18n *keys*, not sentences, so the same result renders in
three languages and the backend can reject a submission without knowing anything
about dictionaries.

## What the form does

Five steps for *yes*, two screens for *no*, three for *not sure*. Everything is
server-rendered and toggled; nothing is assembled with `createElement`.

- **Party size is counted, never typed.** The classic "said 4, listed 3" bug
  cannot happen.
- **Diet is meat/vegetarian/vegan plus a separate lactose-free flag.** A
  four-way list would have silently destroyed "vegetarian and lactose-free".
  Ticking lactose-free on a vegan is dropped as redundant rather than nagged at.
- **Children give a whole-number age at 11 June 2027**, not a date of birth. The
  validator rejects any payload containing `birthDate` or `dob` outright, so a
  future change cannot quietly reintroduce a minor's DOB.
- **Progressive disclosure throughout**: the age stepper appears only for a
  child, the high chair only under five, allergen chips only behind a toggle,
  carpool fields only for the relevant travel mode.
- **The Article 9 consent appears only when there is health data to consent to**,
  and is enforced — a vegetarian cannot be submitted without it.
- **Sharing a phone number with another guest needs its own separate consent.**
- Drafts autosave to `sessionStorage`; the first attendee card seeds from the
  lead guest's name.

The mock backend (`scripts/mock-rsvp-server.mjs`) implements the real `/exec`
contract including the awkward parts. It **rejects `application/json`** on
purpose, because Apps Script cannot answer a CORS preflight — a form that sent
JSON would work locally and fail in production, and this makes that mistake
loud.

## Four bugs the tests caught

**1. The language switcher could not preserve `?t=`.** This is the one worth
recording. Block 1 has a unit test proving `switchLocalePath` keeps the query
string, and it passes. But on a *static* page `Astro.url` has no query string —
there is nothing to preserve at build time. The token lives only in the
browser's address bar. So the links were correct and useless: a guest who tapped
"Deutsch" while editing would have lost the only credential they had for their
own RSVP. Fixed with a few lines in `LangSwitcher.astro` that repair the hrefs on
load. The unit test was right about the function and blind to the integration;
only the end-to-end test saw it.

**2. The attendee template sat outside the `<form>`.** The controller scopes its
queries to the form element, so it found nothing to clone and the repeater
rendered zero cards.

**3. The edit page captured the token before it existed.** The form renders with
a placeholder, then fetches the record and sets `data-token`. The controller had
already read the placeholder into a local, so every save went out against a token
that did not exist. The token is now read lazily at submit time.

**4. The child's age defaulted to 0 — a *valid* answer.** A distracted parent
could have submitted "0 years old" for a seven-year-old and nothing would have
flagged it, which lands wrong food in front of a child. The stepper now starts
blank, shows `—`, and validation requires an explicit choice.

## Tests

**Unit (223)** — 92 on the validator alone: every conditional requirement, the
Article 9 gate across all five ways health data can appear, age bands and meal
classes at every boundary, phone normalisation for German and Brazilian
formats, name matching that ignores case and accents, and the two-stage deadline.

**End-to-end (36, mobile and desktop)** — a party of three with a child and a
vegan through to the success screen and its read-back; an edit link reopening
and saving; bad and missing tokens landing on a helpful dead end rather than a
broken page; the decline path in four fields; validation blocking a step and
focusing the first problem; both consent gates; a child with no age; every page
checked for horizontal scroll and console errors; and the language switcher
keeping both the path and the token.

## Where to pick up

**Block 5 — the Apps Script backend.** Everything it needs is defined:

1. `gas/src/handlers.ts` takes injected `{ sheet, mailer, now, lock, uuid }` and
   imports the same `validate.ts`. Testable against an in-memory fake sheet.
2. `gas/src/main.ts` is a thin adapter binding the real globals.
3. esbuild bundles both to `gas/dist/Code.gs` for `clasp push`.
4. Sheet tabs, including the redacted `hotel_block` and `catering_handoff`
   hand-offs, with regression tests asserting the redaction holds.
5. `gas/SETUP.md` — click-by-click, and it must say in bold that redeploying
   needs "Manage deployments → edit → New version", or every edit link already
   emailed to a guest breaks.

The contract the mock server implements is the specification; match it exactly
and the front end needs no changes beyond pointing `PUBLIC_RSVP_ENDPOINT` at the
real `/exec` URL.

**Still needed from the couple before this can go live:** which Google account
owns the sheet, and whether a printed invite code should gate the endpoint.
