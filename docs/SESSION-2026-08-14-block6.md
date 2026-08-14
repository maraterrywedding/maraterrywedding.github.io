# Session log — 14 August 2026, Block 6

**Session ID:** `e57d9812-7ef6-4333-b8a7-c707a86df50a`
**Saved at:** `docs/SESSION-2026-08-14-block6.md`

Accessibility pass. **277 unit + 79 end-to-end tests green.**

---

## Backend is live

Block 5 is deployed and smoke-tested — 18 checks against the real Apps Script
web app, including the honeypot and duplicate-email paths.

It runs on a **separate, wedding-only Google account**, not the couple's primary
one. That was forced by Google's Advanced Protection Program blocking all Apps
Script on `ruasterry@gmail.com`, but it is the better arrangement anyway: guest
names, phone numbers, children's ages and allergies live away from their main
identity, and honouring the "deleted by 30 September 2027" promise becomes as
simple as deleting the account.

The `/exec` URL is in `.env` (gitignored). The same value goes into the GitHub
repository variable `PUBLIC_RSVP_ENDPOINT` at launch.

## Translations

Nothing to do. `pending-translation.json` is empty and the i18n test enforces
it: a key may only be missing from German or Portuguese if it is explicitly
listed there. Translating alongside each block rather than deferring it to the
end meant this block was already finished when it arrived.

## Accessibility

`tests/e2e/a11y.spec.ts` runs axe over ten pages in two viewports, plus the RSVP
form with every conditional block on an attendee card revealed. **Zero
violations.** Beyond axe it checks one `h1` and one `main` per page, that
`lang` is correctly declared on all three language versions, that the skip link
is keyboard-reachable, and that every tap target on the form clears 44px.

Axe catches maybe a third of real accessibility problems — it cannot judge
whether alt text is meaningful or whether an error message makes sense. It is a
floor, not a ceiling. What it does catch reliably is exactly what gets
introduced by accident.

### Three real defects it found

**1. The attendee card's labels were attached to nothing.** Critical, and the
worst of the three. Each card had `<label>Full name</label><input>` with no
`for`/`id` pairing — because the cards are cloned from a template, any id would
be duplicated across every card. So the labels were decorative: sighted users
saw them, screen-reader users heard an unlabelled text box. Fixed by nesting the
input *inside* the label, which needs no id at all and works for any number of
clones.

This is a good illustration of why the form's own test suite could not have
caught it. Every functional test passed throughout — the form worked perfectly,
for people who could see it.

**2. Two horizontally scrolling regions were unreachable by keyboard.** The
weather forecast strip and the dress-code ladder both scroll sideways and
contain nothing focusable, so there was no way to reach the later days or the
formal end of the ladder without a mouse or a touchscreen. Fixed with
`tabindex="0"` and an accessible name.

**3. My own first fix introduced a new violation.** Adding `role="group"` to
those `<ul>`s to give them a name overrode the implicit `list` role, which
orphaned every `<li>` inside — trading one serious violation for another. The
name comes from `aria-labelledby` alone now, with no role override. Worth
remembering: adding an ARIA role *replaces* the native semantics rather than
supplementing them.

Also fixed: the skip-link test was measuring the link mid-transition, since it
slides in over 120ms. The link was always fine; the test was too quick.

## Where to pick up

**Block 7 — launch.** The last block.

1. `git init`, first commit. Nothing sensitive is tracked: `.env`, `scratch/`
   and `gas/dist/` are all ignored.
2. Create the GitHub repo. **The name decides the base path** — calling it
   `<username>.github.io` keeps the site at `/` and avoids a whole class of
   "works locally, 404s in production" bugs. Any other name needs
   `PUBLIC_BASE=/repo-name` set at build time.
3. `.github/workflows/deploy.yml` (build + deploy to Pages) and `ci.yml`
   (typecheck, Vitest, Playwright on pull requests).
4. Settings → Pages → Source: **GitHub Actions**.
5. Settings → Secrets and variables → Actions → **Variables** →
   `PUBLIC_RSVP_ENDPOINT` = the `/exec` URL from `.env`.
6. Live end-to-end test: submit a real RSVP through the deployed site, click the
   link in the confirmation email, change something, confirm the sheet updates.

Still open from the couple, none of it blocking: the WhatsApp number, the gift
policy, the dress-code choice, the Party Photos album link, the ceremony time
(11:00 or 13:00), and verifying the five alternative hotels.
