import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

/**
 * Content collections hold the parts of the site that grow over time, so
 * adding an entry is one new file and never an edit to a template.
 *
 * Each translatable field carries all three languages in a single object, with
 * `null` meaning "not translated yet" — the page then renders the English and
 * marks it up with `lang="en"` so a screen reader switches voice correctly.
 * That is what lets the site go live before the translations are finished.
 */

const localized = z.object({
  en: z.string().min(1),
  de: z.string().nullable().default(null),
  pt: z.string().nullable().default(null),
});

/**
 * `provisional` renders a small "may still change" pill, so guests can tell
 * a settled answer from a placeholder. `draft` is hidden from the site
 * entirely — a half-written answer is worse than no answer.
 */
const status = z.enum(['draft', 'provisional', 'final']).default('final');

const faq = defineCollection({
  // One file holding an array, rather than a file per question: it keeps the
  // whole Q&A reviewable in a single diff, and makes `/addqa` an append.
  loader: file('./src/content/faq.json'),
  schema: z.object({
    /** Lower sorts first. Leave gaps of 10 so entries can be slotted between. */
    order: z.number().int().default(100),
    category: z
      .enum(['basics', 'travel', 'stay', 'food', 'kids', 'gifts', 'dress'])
      .default('basics'),
    status,
    question: localized,
    answer: localized,
  }),
});

const hotels = defineCollection({
  loader: file('./src/content/hotels.json'),
  schema: z.object({
    name: z.string().min(1),
    /** Straight-line kilometres from the venue. The couple asked for a 20 km radius. */
    distanceKm: z.number().nonnegative(),
    minutesByCar: z.number().int().positive().nullable().default(null),
    town: z.string().min(1),
    url: z.string().url().nullable().default(null),
    phone: z.string().nullable().default(null),
    /** Rough nightly price, as a band rather than a number that will go stale. */
    priceBand: z.enum(['budget', 'mid', 'higher']).nullable().default(null),
    kind: z.enum(['hotel', 'guesthouse', 'apartment']).default('hotel'),
    /** True for the wedding venue itself, which is presented differently. */
    isVenue: z.boolean().default(false),
    note: localized.nullable().default(null),
    /**
     * One sentence given extra weight, for the thing a guest must not miss.
     * A separate field rather than markup inside `note`, because notes render
     * as text — putting HTML in translated content is how you end up shipping
     * a stray `<strong>` to a guest.
     */
    callout: localized.nullable().default(null),
    status,
    order: z.number().int().default(100),
  }),
});

export const collections = { faq, hotels };
