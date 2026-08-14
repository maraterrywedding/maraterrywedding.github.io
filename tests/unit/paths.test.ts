import { describe, expect, it } from 'vitest';
import {
  localeFromPath,
  localizedPath,
  normalizeBase,
  stripBase,
  stripLocale,
  switchLocalePath,
  withBase,
} from '@/lib/paths';

/**
 * These tests exist because of one production failure mode and one guest-facing
 * one:
 *
 *  - GitHub Pages serves a project repo from `/<repo>/`, so any path built
 *    without the base 404s only in production, never locally.
 *  - The RSVP edit link is `?t=<token>`. If the language switcher drops the
 *    query string, a guest who taps "Deutsch" while editing loses the only
 *    credential they have for their own submission.
 */

const ROOT = '/';
const SUB = '/bigday-wedding';

describe('normalizeBase', () => {
  it.each([
    ['/', ''],
    ['', ''],
    ['/repo', '/repo'],
    ['/repo/', '/repo'],
    ['repo', '/repo'],
    ['repo/', '/repo'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeBase(input)).toBe(expected);
  });
});

describe('localizedPath', () => {
  it('leaves English unprefixed at the root', () => {
    expect(localizedPath('en', '/', ROOT)).toBe('/');
    expect(localizedPath('en', '/schedule', ROOT)).toBe('/schedule');
  });

  it('prefixes the other locales', () => {
    expect(localizedPath('de', '/schedule', ROOT)).toBe('/de/schedule');
    expect(localizedPath('pt', '/schedule', ROOT)).toBe('/pt/schedule');
  });

  it('produces a trailing slash for a prefixed home page', () => {
    expect(localizedPath('de', '/', ROOT)).toBe('/de/');
    expect(localizedPath('pt', '/', ROOT)).toBe('/pt/');
  });

  it('applies the deployment base', () => {
    expect(localizedPath('en', '/', SUB)).toBe('/bigday-wedding/');
    expect(localizedPath('en', '/schedule', SUB)).toBe('/bigday-wedding/schedule');
    expect(localizedPath('de', '/schedule', SUB)).toBe('/bigday-wedding/de/schedule');
  });

  it('never emits a double slash', () => {
    for (const base of [ROOT, SUB]) {
      for (const lang of ['en', 'de', 'pt'] as const) {
        for (const path of ['/', '/schedule', '/rsvp/edit']) {
          expect(localizedPath(lang, path, base)).not.toMatch(/\/{2,}/);
        }
      }
    }
  });

  it('accepts a path without a leading slash', () => {
    expect(localizedPath('de', 'schedule', ROOT)).toBe('/de/schedule');
  });
});

describe('withBase', () => {
  it('prefixes non-page assets too', () => {
    expect(withBase('/favicon.svg', SUB)).toBe('/bigday-wedding/favicon.svg');
    expect(withBase('/favicon.svg', ROOT)).toBe('/favicon.svg');
  });
});

describe('stripBase', () => {
  it('removes the base and nothing else', () => {
    expect(stripBase('/bigday-wedding/de/schedule', SUB)).toBe('/de/schedule');
    expect(stripBase('/bigday-wedding', SUB)).toBe('/');
    expect(stripBase('/de/schedule', ROOT)).toBe('/de/schedule');
  });

  it('does not strip a path that merely starts with the same letters', () => {
    expect(stripBase('/bigday-wedding-old/x', SUB)).toBe('/bigday-wedding-old/x');
  });
});

describe('localeFromPath', () => {
  it.each([
    ['/', 'en'],
    ['/schedule', 'en'],
    ['/de/', 'de'],
    ['/de/schedule', 'de'],
    ['/pt/rsvp/edit', 'pt'],
  ])('reads %s as %s', (pathname, expected) => {
    expect(localeFromPath(pathname, ROOT)).toBe(expected);
  });

  it('reads the locale through the base', () => {
    expect(localeFromPath('/bigday-wedding/de/schedule', SUB)).toBe('de');
    expect(localeFromPath('/bigday-wedding/schedule', SUB)).toBe('en');
  });

  it('does not mistake a page named like a locale-ish word for a locale', () => {
    expect(localeFromPath('/details', ROOT)).toBe('en');
  });
});

describe('stripLocale', () => {
  it('returns the bare path', () => {
    expect(stripLocale('/de/schedule', ROOT)).toBe('/schedule');
    expect(stripLocale('/schedule', ROOT)).toBe('/schedule');
    expect(stripLocale('/de/', ROOT)).toBe('/');
    expect(stripLocale('/', ROOT)).toBe('/');
    expect(stripLocale('/bigday-wedding/pt/rsvp/edit', SUB)).toBe('/rsvp/edit');
  });
});

describe('switchLocalePath', () => {
  it('swaps only the locale segment', () => {
    expect(switchLocalePath('de', 'https://x.test/schedule', ROOT)).toBe('/de/schedule');
    expect(switchLocalePath('en', 'https://x.test/de/schedule', ROOT)).toBe('/schedule');
    expect(switchLocalePath('pt', 'https://x.test/de/schedule', ROOT)).toBe('/pt/schedule');
  });

  it('PRESERVES the query string — an RSVP edit token must survive', () => {
    const token = '3f0b7a2c-9d41-4e88-9b0e-6c2f1a5d7e33';
    expect(switchLocalePath('de', `https://x.test/rsvp/edit?t=${token}`, ROOT)).toBe(
      `/de/rsvp/edit?t=${token}`,
    );
    expect(switchLocalePath('en', `https://x.test/pt/rsvp/edit?t=${token}`, ROOT)).toBe(
      `/rsvp/edit?t=${token}`,
    );
  });

  it('preserves the hash', () => {
    expect(switchLocalePath('de', 'https://x.test/questions#gifts', ROOT)).toBe(
      '/de/questions#gifts',
    );
  });

  it('preserves both query and hash together, under a base path', () => {
    expect(
      switchLocalePath('pt', 'https://x.test/bigday-wedding/de/rsvp/edit?t=abc#step-3', SUB),
    ).toBe('/bigday-wedding/pt/rsvp/edit?t=abc#step-3');
  });

  it('accepts a URL object', () => {
    const url = new URL('https://x.test/de/stay?from=email');
    expect(switchLocalePath('en', url, ROOT)).toBe('/stay?from=email');
  });

  it('is idempotent when switching to the language already in the path', () => {
    expect(switchLocalePath('de', 'https://x.test/de/travel', ROOT)).toBe('/de/travel');
    expect(switchLocalePath('en', 'https://x.test/travel', ROOT)).toBe('/travel');
  });
});
