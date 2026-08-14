import { describe, expect, it } from 'vitest';
import en from '@/i18n/en.json';
import de from '@/i18n/de.json';
import pt from '@/i18n/pt.json';
import pending from '@/i18n/pending-translation.json';
import { LOCALES, PREFIXED_LOCALES, type Locale } from '@/i18n/locales';
import { hasTranslation, pickLocalized, t } from '@/i18n/utils';

/**
 * English is the reference dictionary. These tests are the mechanism that
 * stops a translation quietly going missing: a key may only be absent from
 * German or Portuguese if it is explicitly listed in pending-translation.json.
 */

const DICTS: Record<Locale, Record<string, string | null>> = { en, de, pt };
// The file carries a `_comment` string alongside the arrays, so the cast has to
// go through `unknown`. Lookups below are by locale key only.
const PENDING = pending as unknown as Record<string, string[]>;

const placeholders = (value: string): string[] =>
  [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe('dictionaries', () => {
  it('has an entry for every locale', () => {
    for (const lang of LOCALES) {
      expect(Object.keys(DICTS[lang]).length).toBeGreaterThan(0);
    }
  });

  it.each(PREFIXED_LOCALES)('%s defines no keys that English does not', (lang) => {
    const unknown = Object.keys(DICTS[lang]).filter((key) => !(key in en));
    expect(unknown, `Unknown keys in ${lang}.json — likely typos`).toEqual([]);
  });

  it.each(PREFIXED_LOCALES)('%s translates every key, or declares it pending', (lang) => {
    const allowed = new Set(PENDING[lang] ?? []);
    const missing = Object.keys(en).filter(
      (key) => !hasTranslation(lang, key) && !allowed.has(key),
    );
    expect(
      missing,
      `Untranslated ${lang} keys. Translate them, or list them in src/i18n/pending-translation.json`,
    ).toEqual([]);
  });

  it.each(PREFIXED_LOCALES)('%s lists nothing as pending that is already translated', (lang) => {
    const stale = (PENDING[lang] ?? []).filter((key) => hasTranslation(lang, key));
    expect(stale, `Remove these from pending-translation.json — they are done`).toEqual([]);
  });

  it.each(PREFIXED_LOCALES)('%s uses the same placeholders as English', (lang) => {
    const mismatched: string[] = [];
    for (const [key, value] of Object.entries(en)) {
      const translated = DICTS[lang][key];
      if (typeof translated !== 'string' || translated === '') continue;
      const expected = placeholders(value as string);
      const actual = placeholders(translated);
      if (expected.join(',') !== actual.join(',')) {
        mismatched.push(`${key}: expected {${expected}} but got {${actual}}`);
      }
    }
    expect(mismatched, 'Placeholder mismatch would render a literal {token} to a guest').toEqual([]);
  });

  it('has no empty English values', () => {
    const empty = Object.entries(en)
      .filter(([, v]) => typeof v !== 'string' || v.trim() === '')
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });
});

describe('t()', () => {
  it('returns the localized string', () => {
    expect(t('de', 'nav.home')).toBe('Start');
    expect(t('pt', 'nav.home')).toBe('Início');
    expect(t('en', 'nav.home')).toBe('Home');
  });

  it('interpolates named placeholders', () => {
    expect(t('en', 'lang.switchTo', { name: 'Deutsch' })).toBe('Switch to Deutsch');
  });

  it('leaves an unknown placeholder untouched rather than printing "undefined"', () => {
    expect(t('en', 'lang.switchTo', {})).toBe('Switch to {name}');
  });

  it('throws in dev when the English key is missing, since that is always a bug', () => {
    expect(() => t('en', 'this.key.does.not.exist')).toThrow(/Missing i18n key/);
  });
});

describe('hasTranslation', () => {
  it('is always true for English', () => {
    expect(hasTranslation('en', 'nav.home')).toBe(true);
  });

  it('is false when the locale has no own value', () => {
    expect(hasTranslation('de', 'not.a.real.key')).toBe(false);
  });
});

describe('pickLocalized', () => {
  const field = { en: 'English text', de: 'Deutscher Text', pt: null };

  it('returns the locale text when present', () => {
    expect(pickLocalized(field, 'de')).toEqual({ value: 'Deutscher Text', isFallback: false });
  });

  it('falls back to English and flags it', () => {
    expect(pickLocalized(field, 'pt')).toEqual({ value: 'English text', isFallback: true });
  });

  it('does not flag English itself as a fallback', () => {
    expect(pickLocalized(field, 'en')).toEqual({ value: 'English text', isFallback: false });
  });

  it('treats an empty string as untranslated', () => {
    expect(pickLocalized({ en: 'Hello', de: '' }, 'de')).toEqual({
      value: 'Hello',
      isFallback: true,
    });
  });
});
