/**
 * Countdown to the ceremony.
 *
 * Pure and dependency-free so it can run in the browser island and in Vitest
 * without Astro.
 *
 * The breakdown is derived from elapsed milliseconds, which keeps it
 * self-consistent: `days * 86400000 + hours * 3600000 + …` always equals the
 * remaining time exactly. A calendar-day count would look tidier across the
 * two daylight-saving changes between now and June 2027, but it would break
 * that invariant and make the seconds tick unevenly. The visible cost is that
 * the day boundary shifts by an hour twice a year, which nobody will notice.
 */

export type CountdownState = 'counting' | 'today' | 'past';

export interface CountdownParts {
  state: CountdownState;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Remaining milliseconds. Negative once the ceremony has started. */
  remainingMs: number;
}

const MS_SECOND = 1000;
const MS_MINUTE = 60 * MS_SECOND;
const MS_HOUR = 60 * MS_MINUTE;
const MS_DAY = 24 * MS_HOUR;

/**
 * `YYYY-MM-DD` for an instant, as seen in a given timezone.
 *
 * This is what makes "is it the wedding day?" mean the wedding day *at the
 * venue*. A guest in São Paulo opening the site at 21:00 on 10 June is already
 * on 11 June in Grohnde, and should see "today is the day".
 */
export function zonedDateKey(date: Date | number | string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(date));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function countdown(
  now: Date | number | string,
  target: Date | number | string,
  timeZone: string,
): CountdownParts {
  const nowMs = new Date(now).getTime();
  const targetMs = new Date(target).getTime();
  const remainingMs = targetMs - nowMs;

  const sameDay = zonedDateKey(nowMs, timeZone) === zonedDateKey(targetMs, timeZone);

  if (sameDay) {
    // The whole wedding day reads as "today", including the afternoon — the
    // ceremony starting is not the moment to switch to a past-tense message.
    return { state: 'today', days: 0, hours: 0, minutes: 0, seconds: 0, remainingMs };
  }

  if (remainingMs <= 0) {
    return { state: 'past', days: 0, hours: 0, minutes: 0, seconds: 0, remainingMs };
  }

  return {
    state: 'counting',
    days: Math.floor(remainingMs / MS_DAY),
    hours: Math.floor(remainingMs / MS_HOUR) % 24,
    minutes: Math.floor(remainingMs / MS_MINUTE) % 60,
    seconds: Math.floor(remainingMs / MS_SECOND) % 60,
    remainingMs,
  };
}
