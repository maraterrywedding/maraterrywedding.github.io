/**
 * URL building for a trilingual site that may or may not be served from a
 * sub-path (GitHub Pages serves `<user>.github.io/<repo>/` unless the repo is
 * named `<user>.github.io`).
 *
 * Every internal link goes through here. Hardcoding `href="/rsvp"` anywhere is
 * the bug that produces "works locally, 404s in production".
 *
 * Pure and dependency-free so Vitest can exercise it without Astro.
 */

import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/i18n/locales';

/** `/` → ``, `/repo/` → `/repo`, `repo` → `/repo`. */
export function normalizeBase(base: string): string {
  if (!base || base === '/') return '';
  const withLead = base.startsWith('/') ? base : `/${base}`;
  return withLead.endsWith('/') ? withLead.slice(0, -1) : withLead;
}

function currentBase(): string {
  return normalizeBase(import.meta.env.BASE_URL ?? '/');
}

/** Prefix a root-relative path with the deployment base. */
export function withBase(path: string, base: string = currentBase()): string {
  const b = normalizeBase(base);
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}` || '/';
}

/**
 * Build a locale-aware path.
 * `localizedPath('de', '/schedule')` → `/de/schedule`
 * `localizedPath('en', '/schedule')` → `/schedule`
 */
export function localizedPath(lang: Locale, path: string, base: string = currentBase()): string {
  const b = normalizeBase(base);
  const prefix = lang === DEFAULT_LOCALE ? '' : `/${lang}`;
  const p = path.startsWith('/') ? path : `/${path}`;
  const out = `${b}${prefix}${p}`;
  // Collapse the `/de` + `/` case into `/de/`, and guarantee a leading slash.
  return out.replace(/\/{2,}/g, '/') || '/';
}

/** Remove the deployment base from a pathname. */
export function stripBase(pathname: string, base: string = currentBase()): string {
  const b = normalizeBase(base);
  if (!b) return pathname || '/';
  if (pathname === b) return '/';
  if (pathname.startsWith(`${b}/`)) return pathname.slice(b.length) || '/';
  return pathname || '/';
}

/** Which locale a pathname is currently in. Unprefixed means English. */
export function localeFromPath(pathname: string, base: string = currentBase()): Locale {
  const first = stripBase(pathname, base).split('/').filter(Boolean)[0];
  return first && (LOCALES as readonly string[]).includes(first) && first !== DEFAULT_LOCALE
    ? (first as Locale)
    : DEFAULT_LOCALE;
}

/** Strip both base and locale prefix, leaving a bare path like `/schedule`. */
export function stripLocale(pathname: string, base: string = currentBase()): string {
  const withoutBase = stripBase(pathname, base);
  const segments = withoutBase.split('/').filter(Boolean);
  if (segments.length && (LOCALES as readonly string[]).includes(segments[0]!) && segments[0] !== DEFAULT_LOCALE) {
    segments.shift();
  }
  return `/${segments.join('/')}`;
}

/**
 * Rewrite the current URL into another language.
 *
 * Critically, this preserves the query string and hash. Switching language on
 * `/rsvp/edit?t=<token>` must not drop the token — that would strand a guest
 * with no way back into their own RSVP.
 */
export function switchLocalePath(
  lang: Locale,
  url: URL | string,
  base: string = currentBase(),
): string {
  const { pathname, search, hash } =
    typeof url === 'string' ? new URL(url, 'https://placeholder.invalid') : url;
  return localizedPath(lang, stripLocale(pathname, base), base) + search + hash;
}
