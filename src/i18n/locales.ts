/** Locale constants, kept dependency-free so both Astro and Vitest can import them. */

export const LOCALES = ['en', 'de', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Locales that carry a URL prefix. English lives at the root. */
export const PREFIXED_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

/** Names shown in the language switcher, each written in its own language. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  pt: 'Português',
};

/** BCP-47 tags for `lang` attributes, `hreflang` and Intl formatting. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-GB',
  de: 'de-DE',
  pt: 'pt-BR',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
