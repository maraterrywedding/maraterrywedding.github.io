# Session log — 14 August 2026, Block 7

**Session ID:** `e57d9812-7ef6-4333-b8a7-c707a86df50a`
**Saved at:** `docs/SESSION-2026-08-14-block7.md`

Ready to launch. **287 unit + 41 end-to-end tests green, type check clean.**
Committed on `main` as `be47190`.

---

## The party code, corrected

The earlier design assumed a code printed on the invitations. There isn't one.
What the couple wanted was a code **generated when a guest replies**, usable to
get back into their answer later.

So the entry gate is off (`EVENT.rsvp.inviteCode` is null — setting it turns the
gate back on if they ever do print one), and the party code now does real work.

**It went from four characters to six, and now requires the email address too.**
Four characters is about a million combinations. That was fine while the code
was only a seating reference, but it now unlocks a guest's own RSVP — and behind
that sit names, phone numbers, children's ages and allergies. A script would
walk a million values in minutes. Six is about a billion, and pairing it with
the address it was issued to closes it off properly: an attacker needs both, and
addresses cannot be enumerated. Tested from both directions — right code with
the wrong address, and right address with the wrong code, both refused.

`/rsvp/edit` with no token is no longer a dead end. It is the normal thing
someone does when they have lost the email, so it shows a "find your answer"
form instead.

Verified against the live backend: 22 smoke checks, including the new lookup.

## Deployment

`.github/workflows/deploy.yml` builds and publishes to Pages on every push to
`main`. It **fails loudly if `PUBLIC_RSVP_ENDPOINT` is unset** rather than
shipping a site whose form silently does nothing.

`ci.yml` runs the type check, unit tests, and the end-to-end and accessibility
suites on every pull request, uploading the Playwright report when something
fails.

Repo: `maraterrywedding/maraterrywedding.github.io`, so the site is served from
the root and `base` stays `/`.

## One thing caught just before the first commit

**The original photos were about to be published with their GPS coordinates.**

GitHub Pages on the free plan requires a public repo. `resources/fotos/` was
staged, and those files still carry 16–32 KB of EXIF each — Pixel photos, so
that includes where they were taken. Block 1's `prep-photos.mjs` strips EXIF
from the web copies precisely to avoid this, and committing the originals would
have handed it all straight back.

Checked rather than assumed: the originals report 16,760–32,574 bytes of EXIF,
the processed copies report none. `resources/fotos/` is now gitignored with the
reason written next to it, and the folder flagged as needing a backup elsewhere
— it is the only copy, and the site images are regenerated from it.

`.obsidian/` was also staged and is now ignored.

## Type check

`npx astro check` was never wired into the loop, so ten errors had accumulated —
all in test files, which Vitest runs without typechecking. Fixed:
`zonedDateKey` did not accept the string arguments its tests passed, a JSON
import needed a cast through `unknown`, and a test helper's `= 'meat' as const`
default had narrowed its own parameter to that one literal. Plus three unused
imports. It now runs in CI on every pull request, so this cannot silently
accumulate again.

## Where to pick up

Five minutes of clicking, all in `docs/PROGRESS.md` under **Going live**:
create the public repo, push, add the `PUBLIC_RSVP_ENDPOINT` variable, set Pages
to build from GitHub Actions.

Then one real RSVP through the live site, end to end, and delete the test row.

### Content still open, none of it blocking

Ceremony time (11:00 or 13:00) · gift policy · dress code choice · Party Photos
album link · WhatsApp number · verifying the five alternative hotels.

Worth a thought: the public contact address is `ruasterry@gmail.com`. Now that
there is a wedding-only Google account, that might be the better one to show on
the site — it is a one-line change in `src/data/event.ts`.
