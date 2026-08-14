/**
 * The RSVP data model.
 *
 * Pure, dependency-free ESM. This file and `validate.ts` are the keystone of
 * the whole RSVP feature: they are imported by the browser form, bundled into
 * the Google Apps Script backend, and exercised directly by Vitest. One
 * implementation, three consumers — so client and server cannot disagree about
 * what a valid submission looks like.
 *
 * Two deliberate departures from the original brief, both to protect the data:
 *
 *  - Party size is DERIVED from the attendee list, never submitted. Asking for
 *    it separately is how you end up with `partySize: 4` and three names.
 *  - Diet is a single choice of meat/vegetarian/vegan PLUS a separate
 *    lactose-free flag. The brief listed all four as one list, but
 *    "vegetarian and lactose-free" is common and a four-way choice silently
 *    destroys it. Caterers think in base dish × modifiers.
 */

export const ATTENDANCE = ['yes', 'no', 'maybe'] as const;
export type Attendance = (typeof ATTENDANCE)[number];

export const DIETS = ['meat', 'vegetarian', 'vegan'] as const;
export type Diet = (typeof DIETS)[number];

/**
 * The fourteen allergens that EU food law requires to be declared. Using the
 * regulated list rather than an ad-hoc one means the caterer receives exactly
 * the categories they already work in.
 */
export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

/** Shown first; the rest are behind a "show all" toggle. */
export const COMMON_ALLERGENS: readonly Allergen[] = [
  'gluten',
  'milk',
  'nuts',
  'peanuts',
  'eggs',
  'fish',
  'soy',
  'sesame',
];

export const YES_NO_UNSURE = ['yes', 'no', 'unsure'] as const;
export type YesNoUnsure = (typeof YES_NO_UNSURE)[number];

export const HOTEL_STATUS = ['yes', 'no', 'undecided'] as const;
export type HotelStatus = (typeof HOTEL_STATUS)[number];

export const TRAVEL_MODES = ['own_car', 'rental_car', 'train_taxi', 'carpool', 'other'] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

/** Where a guest needing a lift would set off from. Kept short on purpose. */
export const CARPOOL_REGIONS = [
  'hannover',
  'hameln',
  'bielefeld',
  'goettingen',
  'kassel',
  'hamburg',
  'berlin',
  'other',
] as const;
export type CarpoolRegion = (typeof CARPOOL_REGIONS)[number];

/** Dial codes offered in the phone field. Germany, Brazil and Portugal first. */
export const PHONE_COUNTRIES = ['+49', '+55', '+351', '+44', '+1', '+41', '+43', '+31'] as const;

export const LIMITS = {
  maxParty: 8,
  maxSongs: 3,
  maxMessage: 500,
  maxName: 80,
  maxAllergenOther: 120,
  maxRooms: 4,
  maxCots: 2,
  maxCarpoolSeats: 6,
  maxChildAge: 17,
} as const;

export interface Attendee {
  fullName: string;
  isChild: boolean;
  /** Whole years on the wedding day. Required when `isChild`, else null. */
  ageAtEvent: number | null;
  diet: Diet;
  lactoseFree: boolean;
  allergens: Allergen[];
  allergenOther: string;
  needsHighchair: boolean;
}

export interface SongRequest {
  title: string;
  artist: string;
}

export interface RsvpPayload {
  status: Attendance;
  leadFirstName: string;
  leadLastName: string;
  email: string;
  /** Normalised to E.164 by the validator. */
  phone: string;
  phoneIsWhatsapp: boolean;
  attendees: Attendee[];
  /** Only used on the "not sure yet" path, where names are not collected. */
  expectedPartySize: number | null;
  eveningParty: YesNoUnsure | null;
  hotelStatus: HotelStatus | null;
  /** ISO dates, restricted to the three nights the venue offers. */
  nights: string[];
  roomsRequested: number | null;
  cots: number;
  travelMode: TravelMode | null;
  carpoolOfferSeats: number;
  carpoolNeedFrom: CarpoolRegion | null;
  carpoolShareConsent: boolean;
  songs: SongRequest[];
  message: string;
  consentPrivacy: boolean;
  consentHealthData: boolean;
  locale: string;
  /** What the guest typed on the invitation-code screen, normalised. */
  inviteCode: string;
  /**
   * Whether it matched. Recorded, never enforced — a guest who has lost their
   * card is let through and flagged so the couple can check, rather than turned
   * away at the door.
   */
  inviteCodeValid: boolean;
}

// ---------------------------------------------------------------------------
// Derived values. Computed rather than collected, so they cannot contradict
// the raw answers, and so they can be recomputed if a rule changes later.
// ---------------------------------------------------------------------------

export type AgeBand = 'infant' | 'youngChild' | 'child' | 'tween' | 'teen' | 'adult';

/**
 * Age bands are a reporting concept, derived here and never asked. Keeping the
 * raw integer means the bands can be redrawn if the caterer's kids-menu cutoff
 * turns out to be different.
 */
export function ageBand(attendee: Pick<Attendee, 'isChild' | 'ageAtEvent'>): AgeBand {
  if (!attendee.isChild || attendee.ageAtEvent === null) return 'adult';
  const age = attendee.ageAtEvent;
  if (age <= 2) return 'infant';
  if (age <= 5) return 'youngChild';
  if (age <= 9) return 'child';
  if (age <= 15) return 'tween';
  return 'teen';
}

/**
 * The single column a caterer can pivot on.
 *
 * Under-threes get no meal charge; three to nine get the children's menu;
 * everyone else eats an adult portion. Anything with an allergen or an
 * intolerance is suffixed so it is always listed separately rather than
 * quietly folded into a headcount.
 */
export function mealClass(attendee: Attendee): string {
  const band = ageBand(attendee);
  const special =
    attendee.allergens.length > 0 || attendee.allergenOther.trim() !== '' || attendee.lactoseFree;

  let base: string;
  if (band === 'infant') base = 'infant_no_meal';
  else if (band === 'youngChild' || band === 'child') base = `kids_${attendee.diet}`;
  else base = `adult_${attendee.diet}`;

  return special && base !== 'infant_no_meal' ? `${base}_special` : base;
}

/** Party size, always counted rather than typed. */
export function partySize(payload: Pick<RsvpPayload, 'status' | 'attendees' | 'expectedPartySize'>): number {
  if (payload.status === 'maybe') return payload.expectedPartySize ?? 0;
  return payload.attendees.length;
}

export function countAdults(attendees: Attendee[]): number {
  return attendees.filter((a) => ageBand(a) === 'adult' || ageBand(a) === 'teen').length;
}

export function countChildren(attendees: Attendee[]): number {
  return attendees.length - countAdults(attendees);
}

/** Sensible default for the rooms stepper: two adults to a room. */
export function suggestedRooms(attendees: Attendee[]): number {
  const adults = attendees.filter((a) => !a.isChild).length;
  return Math.min(LIMITS.maxRooms, Math.max(1, Math.ceil(adults / 2)));
}

export function emptyAttendee(): Attendee {
  return {
    fullName: '',
    isChild: false,
    ageAtEvent: null,
    // Left deliberately unset in the UI so the guest has to choose; the type
    // needs a value, and 'meat' is only a placeholder the form overrides.
    diet: 'meat',
    lactoseFree: false,
    allergens: [],
    allergenOther: '',
    needsHighchair: false,
  };
}
