---
name: addqa
description: Use when the user's message contains `/addqa` — as a slash command, on its own line, or as a prefix followed by a question and answer for the wedding website's Q&A page. Adds one entry to src/content/faq.json in all three languages, then verifies the build. Do NOT trigger on general questions about the FAQ, on requests to edit an existing answer, or on casual mentions of adding a question — only on an explicit `/addqa`.
---

# Add a Q&A entry

Adds one question and answer to the wedding site's Q&A page, translated into all
three languages, and verifies it before finishing.

## Input

Everything after `/addqa` is the content. Accept any of these shapes:

- `/addqa Is there parking? | Yes, free parking at the venue.`
- `/addqa Is there parking? Yes, free parking at the venue.`
- `/addqa` followed by the question and answer on separate lines.

Split on the first `|` if present. Otherwise treat the first sentence ending in
`?` as the question and the rest as the answer. **If you cannot confidently tell
where the question ends and the answer begins, ask — do not guess.**

If the user gives a question with no answer, still add the entry, with
`"status": "provisional"` and an answer that honestly says the couple are still
deciding. Never invent a factual answer, and in particular never invent a
policy on gifts, plus-ones, or children — those are the couple's to decide.

## Steps

1. **Read `src/content/faq.json`.** It is a JSON array of entries.

2. **Check for a duplicate.** If an existing entry asks substantially the same
   thing, do not add a second one. Say which entry already covers it and offer
   to update that instead.

3. **Build the new entry:**

   ```jsonc
   {
     "id": "kebab-case-slug",        // short, from the question; must be unique
     "order": 130,                    // current maximum + 10
     "category": "basics",            // basics | travel | stay | food | kids | gifts | dress
     "status": "final",               // or "provisional" if the answer may change
     "question": { "en": "…", "de": "…", "pt": "…" },
     "answer":   { "en": "…", "de": "…", "pt": "…" }
   }
   ```

   - `order` must be the current maximum plus 10, so entries stay slottable.
   - `id` must be unique. Check the existing ids before choosing.
   - Gift-, plus-one- and dress-related questions belong in their own
     categories, not `basics`.

4. **Translate into all three languages.** Whichever language the user wrote in,
   fill in the other two. Do not leave `null` here — a Q&A entry is short and
   there is no reason to ship it half-translated.

   Match the site's voice, which is set in `src/i18n/en.json`:
   - Warm, first-person plural: "we", "us", never "the couple" or "the hosts".
   - Plain and direct. No wedding-industry register.
   - German uses the informal plural (*ihr*, *euch*), never *Sie*.
   - Portuguese is **Brazilian** (*vocês*), not European.
   - One to three sentences. Longer than that belongs on a dedicated page.

5. **Write the file back**, preserving two-space indentation and keeping the
   array in `order` sequence.

6. **Verify** — both, and report real output:

   ```bash
   npm run test
   ```

   ```bash
   npm run build
   ```

   The content schema is enforced at build time, so a malformed entry fails
   there rather than silently rendering wrong.

7. **Report** the entry's `id` and the three URLs it is now reachable at:
   `/questions#<id>`, `/de/questions#<id>`, `/pt/questions#<id>`.

## Notes

- Do not touch `src/i18n/*.json`. Q&A text lives in the content collection, not
  the UI dictionary.
- Do not edit the page template. Adding an entry is a data change only; if it
  needs a template change, something is wrong with the request.
- `status: "draft"` hides an entry from the site entirely. Use it if the couple
  want to park a question without publishing it.
