/**
 * Date and time formatting.
 *
 * Everything is rendered in the venue's timezone, never the visitor's: a guest
 * reading this in São Paulo must see the ceremony at 11:00, not 06:00.
 *
 * Never hand-format a date. `11.06.2027` reads as 6 November to an American
 * and as 11 June to a German, and this site has readers of both kinds.
 */

import { LOCALE_TAGS, type Locale } from '@/i18n/locales';
import { EVENT } from '@/data/event';

const TZ = EVENT.timeZone;

function tag(lang: Locale): string {
  return LOCALE_TAGS[lang];
}

/** "11 June 2027" / "11. Juni 2027" / "11 de junho de 2027" */
export function formatDate(iso: string, lang: Locale): string {
  return new Intl.DateTimeFormat(tag(lang), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  }).format(new Date(iso));
}

/** "Friday, 11 June 2027" */
export function formatDateWithWeekday(iso: string, lang: Locale): string {
  return new Intl.DateTimeFormat(tag(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  }).format(new Date(iso));
}

/** "Friday" / "Freitag" / "sexta-feira" */
export function formatWeekday(iso: string, lang: Locale): string {
  return new Intl.DateTimeFormat(tag(lang), { weekday: 'long', timeZone: TZ }).format(new Date(iso));
}

/** "11:00" — 24-hour everywhere, since the venue and most guests are European. */
export function formatTime(iso: string, lang: Locale): string {
  return new Intl.DateTimeFormat(tag(lang), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TZ,
  }).format(new Date(iso));
}

/** "Thu 10 June" — compact label for the hotel-night checkboxes. */
export function formatShortDate(iso: string, lang: Locale): string {
  return new Intl.DateTimeFormat(tag(lang), {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: TZ,
  }).format(new Date(iso));
}

/**
 * "Thursday 10 June" — the same idea spelled out, for use inside a sentence
 * where an abbreviation ("qui., 10 de junho") reads as clipped.
 */
export function formatDayAndMonth(iso: string, lang: Locale): string {
  return new Intl.DateTimeFormat(tag(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TZ,
  }).format(new Date(iso));
}

/** Machine-readable value for a `<time datetime="…">` attribute. */
export function isoDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
