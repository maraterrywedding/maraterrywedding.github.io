/**
 * Single source of truth for the wedding.
 *
 * Nothing in this project should hardcode a date, a time or an address —
 * it all derives from here. The ceremony time in particular is still
 * unconfirmed (it may move from 11:00 to 13:00), so it must never be typed
 * into a translation string or a content file.
 */

export const EVENT = {
  couple: {
    /** Display order used in headings, the browser tab and email subjects. */
    display: 'Mara & Terry',
    first: 'Mara',
    second: 'Terry',
  },

  timeZone: 'Europe/Berlin',

  /**
   * Friday 11 June 2027. +02:00 because June is CEST.
   * NOT FINAL — may move to 13:00. Anything user-facing must format this
   * value rather than repeat it, and honour `ceremonyTimeConfirmed`.
   */
  ceremony: '2027-06-11T11:00:00+02:00',
  ceremonyTimeConfirmed: false,

  /** When guests should actually turn up — welcome drinks, not the ceremony. */
  guestsArriveFrom: '2027-06-11T10:30:00+02:00',

  /** The couple are on site from the night before; used to sell the Thursday night. */
  coupleArrive: '2027-06-10',

  /**
   * The nights the venue hotel is offered for — the night before and the
   * wedding night. Rooms are only being held for these two.
   *
   * The backend validates submitted nights against its OWN copy in the
   * spreadsheet's Config tab, so changing this list alone is not enough: the
   * `hotelNights` cell has to match, or a guest's choice gets rejected.
   */
  hotelNights: ['2027-06-10', '2027-06-11'],

  rsvp: {
    /**
     * Soft deadline: the form STAYS OPEN. This is the early headcount used to
     * hold hotel rooms. After it passes the form shows a gentle nudge and
     * stamps new submissions as late.
     */
    softDeadline: '2026-11-05T23:59:59+01:00',
    /**
     * Hard lock: the form goes READ-ONLY. Tokens keep working so guests can
     * still see what they answered — never a dead end.
     */
    hardLock: '2026-12-15T23:59:59+01:00',
    /** Set from the PUBLIC_RSVP_ENDPOINT env var / GitHub repo variable. */
    endpoint: import.meta.env.PUBLIC_RSVP_ENDPOINT ?? '',
    /**
     * OFF. There is no code printed on the invitations, so the form opens
     * straight away.
     *
     * If the couple ever do print one, put it here and the entry gate comes
     * back automatically — only a SHA-256 of it reaches the browser. Note it
     * would be a speed bump against bots rather than a lock, and a guest who
     * could not produce it would still be let through and flagged.
     *
     * This is unrelated to the party code every guest receives after replying,
     * which is generated per party and always active.
     */
    inviteCode: null as string | null,
    maxParty: 8,
    maxSongs: 3,
    maxMessageLength: 500,
  },

  venue: {
    name: 'Grohnder Fährhaus',
    street: 'Grohnder Fähre 1',
    postcode: '31860',
    city: 'Emmerthal-Grohnde',
    country: 'Germany',
    /** TODO: verify against the venue's own map pin before launch. */
    lat: 52.028,
    lon: 9.415,
    website: 'https://www.grohnder-faehrhaus-hotel.de/',
    phone: '',
  },

  /**
   * Google Photos shared-album links. Null until the couple create them —
   * the pages render a "opening soon" state instead of a broken QR code.
   */
  albums: {
    /** Guests upload old photos of the couple, ahead of the wedding. */
    memories: 'https://photos.app.goo.gl/ytb7CSmWcp7JQ3bE6' as string | null,
    /** Guests upload photos taken on the day. Still to be created. */
    party: null as string | null,
  },

  /** Where guests reach a human when a form can't help them. */
  contact: {
    email: 'maraterrywedding@gmail.com',
    whatsapp: '',
  },
} as const;

/** Full postal address on one line, for maps links and email footers. */
export function venueAddress(): string {
  const v = EVENT.venue;
  return `${v.name}, ${v.street}, ${v.postcode} ${v.city}, ${v.country}`;
}

/** Directions link that works on every platform without an API key. */
export function directionsUrl(): string {
  const q = encodeURIComponent(`${EVENT.venue.street}, ${EVENT.venue.postcode} ${EVENT.venue.city}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}
