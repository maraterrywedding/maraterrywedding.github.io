import { describe, expect, it } from 'vitest';
import faq from '@/content/faq.json';
import hotels from '@/content/hotels.json';
import { SCHEDULE, guestSchedule } from '@/data/schedule';
import { CHOSEN_CODE, DRESS_CODES, DRESS_TIPS } from '@/data/dresscode';
import { TRAVEL_ROUTES } from '@/data/travel';
import { PRIVACY_SECTIONS } from '@/data/privacy';
import { LOCALES } from '@/i18n/locales';

/**
 * The Astro content schema already checks the shape of faq.json and
 * hotels.json at build time. These tests cover what a schema cannot: that the
 * data is internally consistent and says true things.
 *
 * The data files (schedule, dress code, travel, privacy) have no build-time
 * schema at all, so this is their only guard.
 */

type Localizedish = { en?: unknown; de?: unknown; pt?: unknown };

/** Every translatable field must at least have real English text. */
function expectEnglish(field: Localizedish, where: string) {
  expect(typeof field.en, `${where}: missing English`).toBe('string');
  expect((field.en as string).trim().length, `${where}: empty English`).toBeGreaterThan(0);
}

/** No leftover placeholder text should ever reach a guest. */
const PLACEHOLDER = /\b(lorem ipsum|TODO|TBD|FIXME|XXX)\b/i;

describe('faq.json', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(faq)).toBe(true);
    expect(faq.length).toBeGreaterThan(0);
  });

  it('has unique ids', () => {
    const ids = faq.map((e) => e.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it('has unique order values, so the sort is stable', () => {
    const orders = faq.map((e) => e.order);
    expect(orders).toEqual([...new Set(orders)]);
  });

  it('uses slug-shaped ids, since they become URL fragments', () => {
    for (const entry of faq) {
      expect(entry.id, `${entry.id} is not a slug`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('uses only known categories and statuses', () => {
    const categories = ['basics', 'travel', 'stay', 'food', 'kids', 'gifts', 'dress'];
    const statuses = ['draft', 'provisional', 'final'];
    for (const entry of faq) {
      expect(categories, `${entry.id}`).toContain(entry.category);
      expect(statuses, `${entry.id}`).toContain(entry.status);
    }
  });

  it('is fully translated in all three languages', () => {
    for (const entry of faq) {
      for (const locale of LOCALES) {
        for (const field of ['question', 'answer'] as const) {
          const value = (entry[field] as Record<string, string>)[locale];
          expect(typeof value, `${entry.id}.${field}.${locale}`).toBe('string');
          expect(value.trim().length, `${entry.id}.${field}.${locale} is empty`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('phrases every question as a question', () => {
    for (const entry of faq) {
      expect(entry.question.en, `${entry.id}`).toMatch(/\?$/);
    }
  });

  it('contains no placeholder text', () => {
    for (const entry of faq) {
      expect(entry.answer.en, `${entry.id}`).not.toMatch(PLACEHOLDER);
    }
  });
});

describe('hotels.json', () => {
  it('has unique ids', () => {
    const ids = hotels.map((h) => h.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it('stays inside the 20 km radius the couple asked for', () => {
    for (const hotel of hotels) {
      expect(hotel.distanceKm, `${hotel.name} is outside the radius`).toBeLessThanOrEqual(20);
    }
  });

  it('marks exactly one entry as the venue, and puts it first', () => {
    const venues = hotels.filter((h) => h.isVenue);
    expect(venues).toHaveLength(1);
    expect(venues[0]!.distanceKm).toBe(0);
    // The venue is the recommendation, so it must sort to the top.
    const lowestOrder = Math.min(...hotels.map((h) => h.order));
    expect(venues[0]!.order).toBe(lowestOrder);
  });

  it('gives the venue a booking link — it is the one guests will actually use', () => {
    const venue = hotels.find((h) => h.isVenue)!;
    expect(venue.url).toBeTruthy();
  });

  it('has English text for every note', () => {
    for (const hotel of hotels) {
      if (hotel.note) expectEnglish(hotel.note, hotel.id);
    }
  });
});

describe('schedule', () => {
  it('uses 24-hour HH:MM times throughout', () => {
    for (const entry of SCHEDULE) {
      expect(entry.time, entry.title.en).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      if (entry.until) expect(entry.until).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    }
  });

  it('runs in chronological order', () => {
    const minutes = SCHEDULE.map((e) => {
      const [h, m] = e.time.split(':').map(Number);
      return h! * 60 + m!;
    });
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
  });

  it('ends each window after it starts', () => {
    for (const entry of SCHEDULE) {
      if (!entry.until) continue;
      expect(entry.until > entry.time, `${entry.title.en} ends before it starts`).toBe(true);
    }
  });

  it('hides vendor logistics from guests', () => {
    const guest = guestSchedule();
    expect(guest.every((e) => !e.internal)).toBe(true);
    // The two known internal entries: decorating access and the photo package.
    expect(SCHEDULE.length - guest.length).toBe(2);
    expect(guest.some((e) => e.time === '10:00')).toBe(false);
    expect(guest.some((e) => e.time === '16:00')).toBe(false);
  });

  it('still shows guests every moment marked as an anchor', () => {
    // Checked by meaning, not by clock time. Times shift as the plan firms up —
    // the earlier version hardcoded 18:00 and broke the moment dinner moved,
    // which told us nothing useful. What actually matters is that no
    // highlighted moment is ever accidentally flagged `internal` and hidden.
    const guest = guestSchedule();
    const anchors = SCHEDULE.filter((entry) => entry.highlight);

    expect(anchors.length, 'the day should have at least three anchors').toBeGreaterThanOrEqual(3);
    for (const anchor of anchors) {
      expect(guest, `guests must see "${anchor.title.en}"`).toContain(anchor);
    }
  });

  it('is fully translated', () => {
    for (const entry of SCHEDULE) {
      for (const locale of LOCALES) {
        expect(entry.title[locale], `${entry.time} title.${locale}`).toBeTruthy();
        if (entry.note) expect(entry.note[locale], `${entry.time} note.${locale}`).toBeTruthy();
      }
    }
  });
});

describe('dress code', () => {
  it('offers the four codes in increasing formality', () => {
    expect(DRESS_CODES.map((c) => c.id)).toEqual([
      'smart-casual',
      'cocktail',
      'formal',
      'black-tie',
    ]);
  });

  it('either has no choice yet, or a choice that exists', () => {
    if (CHOSEN_CODE === null) return;
    expect(DRESS_CODES.map((c) => c.id)).toContain(CHOSEN_CODE);
  });

  it('is fully translated', () => {
    for (const code of DRESS_CODES) {
      for (const locale of LOCALES) {
        for (const field of ['name', 'gloss', 'feminine', 'masculine', 'likeGoingTo'] as const) {
          expect(code[field][locale], `${code.id}.${field}.${locale}`).toBeTruthy();
        }
      }
    }
    for (const tip of DRESS_TIPS) {
      for (const locale of LOCALES) {
        expect(tip.title[locale], `${tip.id}.title.${locale}`).toBeTruthy();
        expect(tip.body[locale], `${tip.id}.body.${locale}`).toBeTruthy();
      }
    }
  });

  it('keeps the venue-specific advice, which holds whatever code is chosen', () => {
    const ids = DRESS_TIPS.map((t) => t.id);
    for (const required of ['grass', 'weather', 'colour']) {
      expect(ids).toContain(required);
    }
  });
});

describe('travel', () => {
  it('covers every way a guest might arrive', () => {
    const modes = new Set(TRAVEL_ROUTES.map((r) => r.mode));
    for (const mode of ['air', 'rail', 'car', 'taxi']) {
      expect(modes, `no route for ${mode}`).toContain(mode);
    }
  });

  it('is fully translated', () => {
    for (const route of TRAVEL_ROUTES) {
      for (const locale of LOCALES) {
        expect(route.from[locale], `${route.id}.from.${locale}`).toBeTruthy();
        expect(route.body[locale], `${route.id}.body.${locale}`).toBeTruthy();
        if (route.duration) expect(route.duration[locale], `${route.id}.duration`).toBeTruthy();
      }
    }
  });

  it('states no exact departure time as fact — June 2027 timetables do not exist yet', () => {
    for (const route of TRAVEL_ROUTES) {
      for (const locale of LOCALES) {
        const text = `${route.body[locale] ?? ''} ${route.duration?.[locale] ?? ''}`;
        expect(text, `${route.id}.${locale} looks like a precise timetable claim`).not.toMatch(
          /\b([01]?\d|2[0-3]):[0-5]\d\b/,
        );
      }
    }
  });
});

describe('privacy notice', () => {
  it('covers the points a notice has to cover', () => {
    const ids = PRIVACY_SECTIONS.map((s) => s.id);
    for (const required of ['who', 'what', 'why', 'who-sees', 'how-long', 'rights']) {
      expect(ids, `privacy notice is missing "${required}"`).toContain(required);
    }
  });

  it('explains the special handling of health data', () => {
    expect(PRIVACY_SECTIONS.map((s) => s.id)).toContain('sensitive');
  });

  it('is fully translated', () => {
    for (const section of PRIVACY_SECTIONS) {
      for (const locale of LOCALES) {
        expect(section.title[locale], `${section.id}.title.${locale}`).toBeTruthy();
        expect(section.body[locale], `${section.id}.body.${locale}`).toBeTruthy();
        for (const [i, bullet] of (section.bullets ?? []).entries()) {
          expect(bullet[locale], `${section.id}.bullets[${i}].${locale}`).toBeTruthy();
        }
      }
    }
  });
});
