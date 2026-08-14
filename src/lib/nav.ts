/** The site's navigation, defined once and rendered in every language. */

export interface NavItem {
  /** i18n key for the label. */
  key: string;
  /** Bare path, with no locale prefix and no base — `localizedPath` adds those. */
  path: string;
}

export const NAV: readonly NavItem[] = [
  { key: 'nav.schedule', path: '/schedule' },
  { key: 'nav.travel', path: '/travel' },
  { key: 'nav.stay', path: '/stay' },
  { key: 'nav.dresscode', path: '/dress-code' },
  { key: 'nav.faq', path: '/questions' },
  { key: 'nav.photos', path: '/photos' },
];

export const RSVP_PATH = '/rsvp';
export const PRIVACY_PATH = '/privacy';
export const IMPRINT_PATH = '/imprint';

/** Every bare path the site publishes, used to emit hreflang alternates. */
export const ALL_PATHS: readonly string[] = [
  '/',
  ...NAV.map((n) => n.path),
  RSVP_PATH,
  PRIVACY_PATH,
  IMPRINT_PATH,
];
