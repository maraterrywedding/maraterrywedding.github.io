/**
 * RSVP validation — the one implementation, shared by three consumers.
 *
 * Imported by the browser form (for instant feedback), bundled into the Google
 * Apps Script backend (where it is authoritative), and tested by Vitest. The
 * client copy is a convenience; a guest with the raw endpoint URL is checked by
 * exactly the same code.
 *
 * Errors are returned as i18n KEYS rather than sentences, so the same result can
 * be rendered in English, German or Portuguese, and so the backend can reject a
 * submission without knowing anything about dictionaries.
 */

// Explicit .ts extensions so Node's native ESM resolver can follow this chain —
// the Apps Script backend imports this module, and the mock server runs that
// backend directly under Node. Vite and Vitest are happy either way.
import { normalizeInviteCode } from './invite.ts';
import {
  ALLERGENS,
  ATTENDANCE,
  CARPOOL_REGIONS,
  DIETS,
  HOTEL_STATUS,
  LIMITS,
  TRAVEL_MODES,
  YES_NO_UNSURE,
  type Allergen,
  type Attendee,
  type RsvpPayload,
} from './model.ts';

export interface ValidationOptions {
  /** The three nights the venue offers, from EVENT.hotelNights. */
  hotelNights: readonly string[];
  maxParty?: number;
}

/** Keys are field paths: `email`, `attendees.0.fullName`. */
export type FieldErrors = Record<string, string>;

export interface ValidationResult {
  ok: boolean;
  errors: FieldErrors;
  /** Present only when `ok` — cleaned, coerced and safe to store. */
  value?: RsvpPayload;
}

export const ERR = {
  required: 'rsvp.error.required',
  email: 'rsvp.error.email',
  phone: 'rsvp.error.phone',
  name: 'rsvp.error.name',
  choose: 'rsvp.error.choose',
  childAge: 'rsvp.error.childAge',
  atLeastOneGuest: 'rsvp.error.atLeastOneGuest',
  tooManyGuests: 'rsvp.error.tooManyGuests',
  duplicateName: 'rsvp.error.duplicateName',
  pickANight: 'rsvp.error.pickANight',
  tooManyRooms: 'rsvp.error.tooManyRooms',
  carpoolRegion: 'rsvp.error.carpoolRegion',
  carpoolConsent: 'rsvp.error.carpoolConsent',
  tooLong: 'rsvp.error.tooLong',
  consentPrivacy: 'rsvp.error.consentPrivacy',
  consentHealth: 'rsvp.error.consentHealth',
  unknownValue: 'rsvp.error.unknownValue',
} as const;

// ---------------------------------------------------------------------------
// Small pure helpers, exported so they can be tested and reused by the form.
// ---------------------------------------------------------------------------

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const bool = (value: unknown): boolean => value === true || value === 'true' || value === 'on';

function int(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/**
 * Deliberately permissive. Over-strict email regexes reject valid addresses,
 * and the real check is whether the confirmation email arrives — which the
 * backend flags if it bounces.
 */
export function isEmail(value: string): boolean {
  if (value.length > 200) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);
}

/**
 * Normalise to E.164. Returns null when it cannot be understood, which the
 * caller turns into a field error rather than storing something unusable.
 */
export function normalizePhone(raw: string, dialCode: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already international — trust it and just clean the separators.
  if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
    const digits = trimmed.replace(/^00/, '').replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const cc = dialCode.replace(/\D/g, '');
  if (!cc) return null;

  // Drop the national trunk prefix; +49 0170… is not a real number.
  const national = trimmed.replace(/\D/g, '').replace(/^0+/, '');
  if (national.length < 5 || national.length > 14) return null;

  return `+${cc}${national}`;
}

/** A name must contain at least one letter — "  ", "12345" and "-" are not names. */
export function isPlausibleName(value: string): boolean {
  if (value.length < 2 || value.length > LIMITS.maxName) return false;
  return /\p{L}/u.test(value);
}

/** For duplicate detection: case- and accent-insensitive, whitespace-collapsed. */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Attendee validation
// ---------------------------------------------------------------------------

function validateAttendee(
  raw: Record<string, unknown>,
  index: number,
  errors: FieldErrors,
): Attendee {
  const at = (field: string) => `attendees.${index}.${field}`;

  const fullName = str(raw.fullName).replace(/\s+/g, ' ');
  if (!fullName) errors[at('fullName')] = ERR.required;
  else if (!isPlausibleName(fullName)) errors[at('fullName')] = ERR.name;

  const isChild = bool(raw.isChild);

  let ageAtEvent: number | null = null;
  if (isChild) {
    const age = int(raw.ageAtEvent);
    if (age === null) errors[at('ageAtEvent')] = ERR.required;
    else if (age < 0 || age > LIMITS.maxChildAge) errors[at('ageAtEvent')] = ERR.childAge;
    else ageAtEvent = age;
  }
  // An age submitted for an adult is dropped rather than stored — the form can
  // leave a stale value behind when someone toggles the child switch back off.

  if (!isOneOf(raw.diet, DIETS)) errors[at('diet')] = ERR.choose;
  const diet = isOneOf(raw.diet, DIETS) ? raw.diet : 'meat';

  // Reject unknown allergens outright rather than filtering silently: a value
  // that is not on the list means the payload was tampered with, and letting it
  // through would pollute the sheet the caterer reads.
  const rawAllergens = Array.isArray(raw.allergens) ? raw.allergens : [];
  const allergens: Allergen[] = [];
  for (const candidate of rawAllergens) {
    if (isOneOf(candidate, ALLERGENS)) {
      if (!allergens.includes(candidate)) allergens.push(candidate);
    } else {
      errors[at('allergens')] = ERR.unknownValue;
    }
  }

  const allergenOther = str(raw.allergenOther);
  if (allergenOther.length > LIMITS.maxAllergenOther) errors[at('allergenOther')] = ERR.tooLong;

  // Vegan already excludes dairy, so the flag is redundant; drop it silently
  // rather than nagging someone who ticked both.
  const lactoseFree = diet === 'vegan' ? false : bool(raw.lactoseFree);

  return {
    fullName,
    isChild,
    ageAtEvent,
    diet,
    lactoseFree,
    allergens,
    allergenOther,
    needsHighchair: bool(raw.needsHighchair),
  };
}

// ---------------------------------------------------------------------------
// Payload validation
// ---------------------------------------------------------------------------

export function validateRsvp(input: unknown, options: ValidationOptions): ValidationResult {
  const errors: FieldErrors = {};
  const raw = (input ?? {}) as Record<string, unknown>;
  const maxParty = options.maxParty ?? LIMITS.maxParty;

  // A date of birth must never be accepted. This guards against a future
  // regression reintroducing a minor's DOB, which is materially more sensitive
  // than the integer age the form actually asks for.
  if ('birthDate' in raw || 'dob' in raw || 'birthdate' in raw) {
    errors.birthDate = ERR.unknownValue;
  }

  if (!isOneOf(raw.status, ATTENDANCE)) {
    return { ok: false, errors: { status: ERR.choose } };
  }
  const status = raw.status;

  const leadFirstName = str(raw.leadFirstName).replace(/\s+/g, ' ');
  if (!leadFirstName) errors.leadFirstName = ERR.required;
  else if (!isPlausibleName(leadFirstName)) errors.leadFirstName = ERR.name;

  const leadLastName = str(raw.leadLastName).replace(/\s+/g, ' ');
  if (!leadLastName) errors.leadLastName = ERR.required;
  else if (!isPlausibleName(leadLastName)) errors.leadLastName = ERR.name;

  const email = str(raw.email).toLowerCase();
  if (!email) errors.email = ERR.required;
  else if (!isEmail(email)) errors.email = ERR.email;

  // Phone is only needed from people who are actually coming.
  let phone = '';
  const rawPhone = str(raw.phone);
  if (status === 'yes') {
    if (!rawPhone) {
      errors.phone = ERR.required;
    } else {
      const normalized = normalizePhone(rawPhone, str(raw.phoneDialCode) || '+49');
      if (!normalized) errors.phone = ERR.phone;
      else phone = normalized;
    }
  } else if (rawPhone) {
    phone = normalizePhone(rawPhone, str(raw.phoneDialCode) || '+49') ?? '';
  }

  if (!bool(raw.consentPrivacy)) errors.consentPrivacy = ERR.consentPrivacy;

  const message = str(raw.message);
  if (message.length > LIMITS.maxMessage) errors.message = ERR.tooLong;

  // Recorded, never a reason to reject. The couple would rather have a reply
  // from someone who mislaid their invitation than no reply at all.
  const inviteCode = normalizeInviteCode(str(raw.inviteCode)).slice(0, 32);
  const inviteCodeValid = bool(raw.inviteCodeValid);

  // --- The "no" path stops here. Four fields, one screen, no interrogation. ---
  if (status === 'no') {
    const value: RsvpPayload = {
      status,
      leadFirstName,
      leadLastName,
      email,
      phone,
      phoneIsWhatsapp: false,
      attendees: [],
      expectedPartySize: null,
      eveningParty: null,
      hotelStatus: null,
      nights: [],
      roomsRequested: null,
      cots: 0,
      travelMode: null,
      carpoolOfferSeats: 0,
      carpoolNeedFrom: null,
      carpoolShareConsent: false,
      songs: [],
      message,
      consentPrivacy: true,
      consentHealthData: false,
      locale: str(raw.locale) || 'en',
      inviteCode,
      inviteCodeValid,
    };
    return Object.keys(errors).length ? { ok: false, errors } : { ok: true, errors, value };
  }

  // --- "Not sure yet": a headcount estimate, but no names. ---
  let expectedPartySize: number | null = null;
  if (status === 'maybe') {
    const size = int(raw.expectedPartySize);
    if (size === null) errors.expectedPartySize = ERR.required;
    else if (size < 1 || size > maxParty) errors.expectedPartySize = ERR.tooManyGuests;
    else expectedPartySize = size;
  }

  // --- Attendees, on the "yes" path only. ---
  const attendees: Attendee[] = [];
  if (status === 'yes') {
    const rawAttendees = Array.isArray(raw.attendees) ? raw.attendees : [];
    if (rawAttendees.length === 0) {
      errors.attendees = ERR.atLeastOneGuest;
    } else if (rawAttendees.length > maxParty) {
      errors.attendees = ERR.tooManyGuests;
    } else {
      for (const [index, entry] of rawAttendees.entries()) {
        attendees.push(
          validateAttendee((entry ?? {}) as Record<string, unknown>, index, errors),
        );
      }

      // The same person entered twice within one party is a mistake worth
      // catching. The same name across two different parties is perfectly
      // normal and is only flagged for the couple to review.
      const seen = new Map<string, number>();
      for (const [index, attendee] of attendees.entries()) {
        const key = normalizeName(attendee.fullName);
        if (!key) continue;
        if (seen.has(key)) errors[`attendees.${index}.fullName`] = ERR.duplicateName;
        else seen.set(key, index);
      }
    }
  }

  const eveningParty = isOneOf(raw.eveningParty, YES_NO_UNSURE) ? raw.eveningParty : null;
  if (status === 'yes' && eveningParty === null) errors.eveningParty = ERR.choose;

  // --- Hotel ---
  const hotelStatus = isOneOf(raw.hotelStatus, HOTEL_STATUS) ? raw.hotelStatus : null;
  if (status === 'yes' && hotelStatus === null) errors.hotelStatus = ERR.choose;

  let nights: string[] = [];
  let roomsRequested: number | null = null;
  let cots = 0;

  if (hotelStatus === 'yes') {
    const rawNights = Array.isArray(raw.nights) ? raw.nights : [];
    for (const night of rawNights) {
      if (typeof night === 'string' && options.hotelNights.includes(night)) {
        if (!nights.includes(night)) nights.push(night);
      } else {
        errors.nights = ERR.unknownValue;
      }
    }
    if (nights.length === 0 && !errors.nights) errors.nights = ERR.pickANight;
    nights = nights.slice().sort();

    const rooms = int(raw.roomsRequested);
    if (rooms === null) {
      errors.roomsRequested = ERR.required;
    } else if (rooms < 1 || rooms > LIMITS.maxRooms) {
      errors.roomsRequested = ERR.tooManyRooms;
    } else if (attendees.length > 0 && rooms > attendees.length) {
      // More rooms than people is almost always a mis-tap on the stepper.
      errors.roomsRequested = ERR.tooManyRooms;
    } else {
      roomsRequested = rooms;
    }

    cots = clamp(int(raw.cots) ?? 0, 0, LIMITS.maxCots);
  }
  // When they are not staying, any nights/rooms left over from an earlier answer
  // are cleared rather than stored.

  // --- Travel ---
  const travelMode = isOneOf(raw.travelMode, TRAVEL_MODES) ? raw.travelMode : null;
  if (status === 'yes' && travelMode === null) errors.travelMode = ERR.choose;

  let carpoolOfferSeats = 0;
  let carpoolNeedFrom: import('./model.ts').CarpoolRegion | null = null;

  if (travelMode === 'own_car' || travelMode === 'rental_car') {
    carpoolOfferSeats = clamp(int(raw.carpoolOfferSeats) ?? 0, 0, LIMITS.maxCarpoolSeats);
  }
  if (travelMode === 'carpool') {
    if (!isOneOf(raw.carpoolNeedFrom, CARPOOL_REGIONS)) errors.carpoolNeedFrom = ERR.carpoolRegion;
    else carpoolNeedFrom = raw.carpoolNeedFrom;
  }

  // Putting a guest in touch with another guest shares their name and number
  // with a third party, which is a separate purpose and needs its own consent.
  const carpoolShareConsent = bool(raw.carpoolShareConsent);
  const wantsCarpool = carpoolOfferSeats > 0 || carpoolNeedFrom !== null;
  if (wantsCarpool && !carpoolShareConsent) errors.carpoolShareConsent = ERR.carpoolConsent;

  // --- Songs ---
  const rawSongs = Array.isArray(raw.songs) ? raw.songs : [];
  const songs = rawSongs
    .map((entry) => {
      const song = (entry ?? {}) as Record<string, unknown>;
      return { title: str(song.title).slice(0, 120), artist: str(song.artist).slice(0, 120) };
    })
    // An entry with neither field is an empty row the guest never filled in.
    .filter((song) => song.title !== '' || song.artist !== '')
    .slice(0, LIMITS.maxSongs);

  // --- The Article 9 gate ---
  // Dietary and allergy information is special-category health data. If any of
  // it is present, explicit consent is mandatory, separately from the general
  // privacy consent.
  const hasHealthData = attendees.some(
    (a) =>
      a.allergens.length > 0 ||
      a.allergenOther.trim() !== '' ||
      a.lactoseFree ||
      a.diet !== 'meat',
  );
  const consentHealthData = bool(raw.consentHealthData);
  if (hasHealthData && !consentHealthData) errors.consentHealthData = ERR.consentHealth;

  const value: RsvpPayload = {
    status,
    leadFirstName,
    leadLastName,
    email,
    phone,
    phoneIsWhatsapp: bool(raw.phoneIsWhatsapp),
    attendees,
    expectedPartySize,
    eveningParty,
    hotelStatus,
    nights,
    roomsRequested,
    cots,
    travelMode,
    carpoolOfferSeats,
    carpoolNeedFrom,
    carpoolShareConsent,
    songs,
    message,
    consentPrivacy: true,
    consentHealthData: hasHealthData ? consentHealthData : false,
    locale: str(raw.locale) || 'en',
    inviteCode,
    inviteCodeValid,
  };

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, errors, value };
}

// ---------------------------------------------------------------------------
// Deadline handling — enforced server-side, mirrored client-side for the UI.
// ---------------------------------------------------------------------------

export type RsvpPhase = 'open' | 'late' | 'locked';

/**
 * Two dates, deliberately.
 *
 * The soft deadline is the early headcount used to hold hotel rooms; the form
 * stays open past it and new submissions are simply stamped `late`. Closing the
 * front door early would cost a guest, and a late yes beats an absent one.
 *
 * The hard lock makes the form read-only. The token keeps working so guests can
 * still see what they answered — never a dead end.
 */
export function rsvpPhase(
  now: Date | number | string,
  softDeadline: string,
  hardLock: string,
): RsvpPhase {
  const t = new Date(now).getTime();
  if (t > new Date(hardLock).getTime()) return 'locked';
  if (t > new Date(softDeadline).getTime()) return 'late';
  return 'open';
}

export function isRsvpWritable(phase: RsvpPhase): boolean {
  return phase !== 'locked';
}
