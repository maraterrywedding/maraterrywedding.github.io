# Session log — 14 August 2026, first content round

**Session ID:** `e57d9812-7ef6-4333-b8a7-c707a86df50a`
**Saved at:** `docs/SESSION-2026-08-14-content-round-1.md`

The first pass of real edits after launch. **287 unit tests green.**

---

## New hero photo

The couple supplied an indoor photo — fairy lights, a kiss on the cheek, a
laugh — replacing the vineyard shot, which moves to `coupleVineyard` and is
still available.

Fitting it took three iterations, and the reason is worth recording because it
will recur the next time a photo is swapped.

**Desktop.** At the old hero height the names landed directly across Mara's
face. The image is wider than the hero box, so it is width-constrained and there
is vertical overflow that `object-position` can move — but not enough. The crop
could only shift about 100px, and roughly 115px was needed. The fix was a taller
hero (50rem) *plus* a lower anchor (55%).

**Mobile.** The same fix does nothing, and it took a measurement to see why. On a
narrow viewport the image is **height**-constrained: it covers the box
vertically and is cropped at the sides, so there is no vertical overflow and
`object-position` has nothing to move. The two levers that do work there are a
taller box and a shorter text block — the faces scale with the box while the
text stays a fixed pixel height, so both widen the gap between them. Applied
both: 46rem, smaller display type, tighter padding.

The scrim was also lightened considerably. It had been tuned for a bright
outdoor photo; over this warmer, dimmer one it turned everything muddy and
drowned the lights, which are the best thing in the picture.

> If the hero photo is swapped again, expect to retune **both** `min-height` and
> `object-position`, and to check mobile separately — the two viewports fail in
> different ways for different reasons.

## The day

- Arrival is now "Guests arrive", not "Guests arrive, welcome drinks" — the Sekt
  is after the ceremony, and the note says so: seated by 10:50, water out
  beforehand.
- The Sekt entry carries "the first toast of the day — after the ceremony, not
  before", so the order is unambiguous in three places.
- "Coffee, cake and tortes" → "Coffee and cake".
- Dinner moved 18:00 → 17:00.
- **Quiet hour renamed to quiet time and moved to 16:45**, to make room for
  dinner. It had briefly collided with dinner at 17:00 — two entries at the same
  time, one above the other, which read as a mistake. Flagged rather than
  quietly resolved, since only the couple could decide which moved.
- The photos mention is gone from both the timeline note and the sidebar card.

The rename propagated to four places: the schedule entry, the sidebar heading and
body, and a dress-code tip that referenced "the quiet hour" by name. That tip now
says "there is a moment to change before dinner", which survives further time
changes.

## Dress code

This stopped being an open question. The page previously said "we have not
settled on a dress code yet" behind a *coming soon* pill; it now says:

> **Any of these four is welcome — wear whatever you feel good in.**
> Just two things we would ask: nothing like sweatpants or a hoodie, and nobody
> but the bride in a white dress.

`CHOSEN_CODE` stays `null` **on purpose** — that is the mechanism for narrowing
the page to one code, which is the opposite of what was decided. The dashed
"undecided" border is gone, because this is an answer now.

The white rule was also sharpened in the tips below to name ivory and cream
explicitly, which is where people usually find the loophole.

## Q&A

- **Ceremony location** — was "the ceremony and dinner are inside". Now: hoping
  to be outside, in the garden or by the river, weather depending, decided close
  to the day.
- **Gifts** — answered and marked `final`: not expected, but welcome. The
  provisional pill is gone.
- **Children** — shortened to the couple's own wording. `/addqa` correctly
  refused to add a duplicate and pointed at the existing entry instead, which is
  the behaviour it was written for.

## A test that failed correctly

`still shows guests the moments that anchor the day` hardcoded 10:30, 11:00 and
18:00, and broke the moment dinner moved. That is a test asserting an incidental
fact rather than the thing that matters.

Rewritten to check by **meaning**: every entry marked `highlight` must reach the
guest schedule. It now catches the real failure — an anchor accidentally flagged
`internal` and hidden — and survives every future time change.

## Where to pick up

Nothing outstanding. Open content questions are in `docs/PROGRESS.md`; the
biggest remaining one is the ceremony time, since the whole running order hangs
off it.
