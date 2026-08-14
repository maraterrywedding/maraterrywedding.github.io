import { describe, expect, it } from 'vitest';
import { countdown, zonedDateKey } from '@/lib/countdown';
import { EVENT } from '@/data/event';

const TZ = 'Europe/Berlin';
/** The real ceremony instant: Friday 11 June 2027, 11:00 CEST. */
const CEREMONY = '2027-06-11T11:00:00+02:00';

describe('zonedDateKey', () => {
  it('reports the date as seen at the venue, not in UTC', () => {
    // 22:30 UTC on 10 June is already 00:30 on 11 June in Berlin.
    expect(zonedDateKey('2027-06-10T22:30:00Z', TZ)).toBe('2027-06-11');
  });

  it('does not roll over early', () => {
    expect(zonedDateKey('2027-06-10T21:30:00Z', TZ)).toBe('2027-06-10');
  });

  it('handles the winter offset too', () => {
    // In January Berlin is UTC+1, so 23:30 UTC is still the same day.
    expect(zonedDateKey('2027-01-15T22:30:00Z', TZ)).toBe('2027-01-15');
  });
});

describe('countdown', () => {
  it('counts down whole days, hours, minutes and seconds', () => {
    const result = countdown('2027-06-08T11:00:00+02:00', CEREMONY, TZ);
    expect(result.state).toBe('counting');
    expect(result).toMatchObject({ days: 3, hours: 0, minutes: 0, seconds: 0 });
  });

  it('breaks the remainder down correctly', () => {
    const result = countdown('2027-06-10T08:45:30+02:00', CEREMONY, TZ);
    expect(result.state).toBe('counting');
    expect(result).toMatchObject({ days: 1, hours: 2, minutes: 14, seconds: 30 });
  });

  it('keeps the parts consistent with the remaining milliseconds', () => {
    const result = countdown('2026-08-14T09:17:03+02:00', CEREMONY, TZ);
    const rebuilt =
      result.days * 86_400_000 +
      result.hours * 3_600_000 +
      result.minutes * 60_000 +
      result.seconds * 1000;
    // Equal to within one second — the sub-second part is intentionally dropped.
    expect(result.remainingMs - rebuilt).toBeGreaterThanOrEqual(0);
    expect(result.remainingMs - rebuilt).toBeLessThan(1000);
  });

  it('says "today" from midnight at the venue, before the ceremony', () => {
    expect(countdown('2027-06-11T00:05:00+02:00', CEREMONY, TZ).state).toBe('today');
    expect(countdown('2027-06-11T10:59:59+02:00', CEREMONY, TZ).state).toBe('today');
  });

  it('still says "today" during and after the ceremony, on the day itself', () => {
    expect(countdown('2027-06-11T11:00:00+02:00', CEREMONY, TZ).state).toBe('today');
    expect(countdown('2027-06-11T23:59:00+02:00', CEREMONY, TZ).state).toBe('today');
  });

  it('says "today" to a guest in Brazil whose own clock still reads the 10th', () => {
    // 20:00 on 10 June in São Paulo (UTC-3) is 01:00 on 11 June in Grohnde.
    expect(countdown('2027-06-10T20:00:00-03:00', CEREMONY, TZ).state).toBe('today');
  });

  it('switches to past only once the wedding day is over at the venue', () => {
    expect(countdown('2027-06-12T00:01:00+02:00', CEREMONY, TZ).state).toBe('past');
    expect(countdown('2028-01-01T00:00:00+01:00', CEREMONY, TZ).state).toBe('past');
  });

  it('survives the ceremony moving to 13:00 without any other change', () => {
    const thirteen = '2027-06-11T13:00:00+02:00';
    expect(countdown('2027-06-10T13:00:00+02:00', thirteen, TZ)).toMatchObject({
      state: 'counting',
      days: 1,
      hours: 0,
    });
    expect(countdown('2027-06-11T12:00:00+02:00', thirteen, TZ).state).toBe('today');
  });

  it('spans the March daylight-saving change without losing a day', () => {
    // 2027-03-28 is the CET→CEST switch. Counting across it must not produce a
    // negative or wildly wrong day count.
    const result = countdown('2027-03-27T12:00:00+01:00', CEREMONY, TZ);
    expect(result.state).toBe('counting');
    expect(result.days).toBeGreaterThanOrEqual(75);
    expect(result.days).toBeLessThanOrEqual(76);
  });

  it('works against the real configured event', () => {
    const result = countdown('2026-08-14T12:00:00+02:00', EVENT.ceremony, EVENT.timeZone);
    expect(result.state).toBe('counting');
    // Aug 2026 → Jun 2027 is roughly ten months.
    expect(result.days).toBeGreaterThan(290);
    expect(result.days).toBeLessThan(310);
  });
});
