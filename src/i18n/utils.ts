import en from './en.json';
import de from './de.json';
import pt from './pt.json';
import { DEFAULT_LOCALE, type Locale } from './locales';

/**
 * UI strings. English is the reference dictionary: every key must exist there.
 * A key may be missing (or explicitly `null`) in German or Portuguese while
 * translation is still in progress — it falls back to English, and the caller
 * can mark it up with `lang="en"` so screen readers switch voice correctly.
 */

type Dict = Record<string, string | null>;

const DICTS: Record<Locale, Dict> = { en, de, pt };

export type MessageKey = keyof typeof en;

/** Replace `{name}` placeholders. Values are inserted verbatim, never as HTML. */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Look up a UI string.
 *
 * A missing English key is always a programmer error, so it throws in dev
 * where it gets noticed. In production it degrades to returning the key
 * rather than blanking the page in front of a guest.
 */
export function t(lang: Locale, key: MessageKey | string, vars?: Record<string, string | number>): string {
  const localized = DICTS[lang]?.[key];
  if (localized != null && localized !== '') return interpolate(localized, vars);

  const fallback = (en as Dict)[key];
  if (fallback != null && fallback !== '') return interpolate(fallback, vars);

  if (import.meta.env.DEV) {
    throw new Error(`Missing i18n key "${key}" — it must at least exist in src/i18n/en.json`);
  }
  return String(key);
}

/** True when this locale has its own text and is not silently borrowing English. */
export function hasTranslation(lang: Locale, key: MessageKey | string): boolean {
  if (lang === DEFAULT_LOCALE) return true;
  const value = DICTS[lang]?.[key];
  return value != null && value !== '';
}

/** Every key defined in the reference dictionary. Used by the completeness test. */
export function messageKeys(): string[] {
  return Object.keys(en);
}

export function dictionaryFor(lang: Locale): Dict {
  return DICTS[lang];
}

/**
 * Content-collection fields carry all three languages in one object, with
 * `null` meaning "not translated yet". This resolves one to the text that
 * should actually be rendered, and reports whether English was substituted so
 * the template can add `lang="en"` and a small note.
 */
export interface Localized<T = string> {
  en: T;
  de?: T | null;
  pt?: T | null;
}

export function pickLocalized<T>(
  field: Localized<T>,
  lang: Locale,
): { value: T; isFallback: boolean } {
  const own = lang === DEFAULT_LOCALE ? field.en : field[lang];
  if (own != null && own !== '') return { value: own as T, isFallback: false };
  return { value: field.en, isFallback: lang !== DEFAULT_LOCALE };
}
