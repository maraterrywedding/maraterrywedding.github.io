import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/i18n/locales';

/**
 * Static paths for a `[...locale]` route.
 *
 * Every page exists exactly once as a source file. The rest parameter matches
 * the empty segment for English, so one file produces `/x`, `/de/x` and
 * `/pt/x` — no triplicated markup, no drift between languages.
 */
export function localeStaticPaths(): Array<{
  params: { locale: string | undefined };
  props: { lang: Locale };
}> {
  return LOCALES.map((lang) => ({
    params: { locale: lang === DEFAULT_LOCALE ? undefined : lang },
    props: { lang },
  }));
}
