import { describe, expect, it } from 'vitest';
import {
  ERR,
  isEmail,
  isPlausibleName,
  isRsvpWritable,
  normalizeName,
  normalizePhone,
  rsvpPhase,
  validateRsvp,
} from '@/lib/rsvp/validate';
import {
  ageBand,
  countAdults,
  countChildren,
  mealClass,
  partySize,
  suggestedRooms,
  type Diet,
} from '@/lib/rsvp/model';
import { EVENT } from '@/data/event';

const OPTIONS = { hotelNights: EVENT.hotelNights, maxParty: 8 };

/** A minimal complete "yes" submission, overridable per test. */
function yesPayload(overrides: Record<string, unknown> = {}) {
  return {
    status: 'yes',
    leadFirstName: 'Anna',
    leadLastName: 'Müller',
    email: 'anna@example.com',
    phone: '0170 1234567',
    phoneDialCode: '+49',
    attendees: [{ fullName: 'Anna Müller', diet: 'meat', allergens: [] }],
    eveningParty: 'yes',
    hotelStatus: 'no',
    travelMode: 'own_car',
    consentPrivacy: true,
    locale: 'en',
    ...overrides,
  };
}

describe('isEmail', () => {
  it.each(['a@b.co', 'anna.müller@example.co.uk', 'x+tag@mail.example.com'])('accepts %s', (v) => {
    expect(isEmail(v)).toBe(true);
  });

  it.each(['', 'anna', 'anna@', '@example.com', 'anna @example.com', 'anna@example'])(
    'rejects %s',
    (v) => {
      expect(isEmail(v)).toBe(false);
    },
  );
});

describe('normalizePhone', () => {
  it('adds the dial code and drops the national trunk zero', () => {
    expect(normalizePhone('0170 1234567', '+49')).toBe('+491701234567');
  });

  it('handles Brazilian formatting', () => {
    expect(normalizePhone('(11) 91234-5678', '+55')).toBe('+5511912345678');
  });

  it('leaves an already-international number alone', () => {
    expect(normalizePhone('+49 170 1234567', '+55')).toBe('+491701234567');
    expect(normalizePhone('00491701234567', '+55')).toBe('+491701234567');
  });

  it('rejects what it cannot understand', () => {
    expect(normalizePhone('', '+49')).toBeNull();
    expect(normalizePhone('123', '+49')).toBeNull();
    expect(normalizePhone('not a phone', '+49')).toBeNull();
  });
});

describe('isPlausibleName', () => {
  it.each(['José da Silva-Müller', "O'Brien", 'Ana Beatriz', 'Li'])('accepts %s', (v) => {
    expect(isPlausibleName(v)).toBe(true);
  });

  it.each(['', ' ', 'A', '12345', '---'])('rejects %s', (v) => {
    expect(isPlausibleName(v.trim())).toBe(false);
  });
});

describe('normalizeName', () => {
  it('ignores case, accents and extra spaces when comparing', () => {
    expect(normalizeName('  Anna   MÜLLER ')).toBe('anna muller');
    expect(normalizeName('José')).toBe(normalizeName('jose'));
  });
});

describe('status routing', () => {
  it('rejects an unknown status outright', () => {
    expect(validateRsvp({ status: 'perhaps' }, OPTIONS).errors).toEqual({ status: ERR.choose });
  });

  it('accepts a "no" with only four fields', () => {
    const result = validateRsvp(
      { status: 'no', leadFirstName: 'Bo', leadLastName: 'Lee', email: 'bo@example.com', consentPrivacy: true },
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    expect(result.value?.attendees).toEqual([]);
  });

  it('does not demand a phone number from someone who cannot come', () => {
    const result = validateRsvp(
      { status: 'no', leadFirstName: 'Bo', leadLastName: 'Lee', email: 'bo@example.com', consentPrivacy: true },
      OPTIONS,
    );
    expect(result.errors.phone).toBeUndefined();
  });

  it('strips hotel and travel answers from a "no", rather than storing them', () => {
    const result = validateRsvp(
      {
        status: 'no',
        leadFirstName: 'Bo',
        leadLastName: 'Lee',
        email: 'bo@example.com',
        consentPrivacy: true,
        hotelStatus: 'yes',
        nights: [EVENT.hotelNights[0]],
        travelMode: 'own_car',
        attendees: [{ fullName: 'Bo Lee', diet: 'vegan', allergens: [] }],
      },
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    expect(result.value?.hotelStatus).toBeNull();
    expect(result.value?.travelMode).toBeNull();
    expect(result.value?.nights).toEqual([]);
    expect(result.value?.attendees).toEqual([]);
  });

  it('asks a "maybe" for a headcount but not for names', () => {
    const missing = validateRsvp(
      { status: 'maybe', leadFirstName: 'Bo', leadLastName: 'Lee', email: 'bo@e.com', consentPrivacy: true },
      OPTIONS,
    );
    expect(missing.errors.expectedPartySize).toBe(ERR.required);

    const ok = validateRsvp(
      {
        status: 'maybe',
        leadFirstName: 'Bo',
        leadLastName: 'Lee',
        email: 'bo@e.com',
        consentPrivacy: true,
        expectedPartySize: 3,
        eveningParty: 'unsure',
        hotelStatus: 'undecided',
        travelMode: 'other',
      },
      OPTIONS,
    );
    expect(ok.ok).toBe(true);
    expect(ok.value?.attendees).toEqual([]);
  });
});

describe('required contact fields', () => {
  it('needs both names, an email and a phone on the "yes" path', () => {
    const result = validateRsvp({ status: 'yes' }, OPTIONS);
    expect(result.errors.leadFirstName).toBe(ERR.required);
    expect(result.errors.leadLastName).toBe(ERR.required);
    expect(result.errors.email).toBe(ERR.required);
    expect(result.errors.phone).toBe(ERR.required);
  });

  it('lowercases and trims the email on the way in', () => {
    const result = validateRsvp(yesPayload({ email: '  Anna@Example.COM ' }), OPTIONS);
    expect(result.value?.email).toBe('anna@example.com');
  });

  it('rejects an unparseable phone number', () => {
    expect(validateRsvp(yesPayload({ phone: 'call me' }), OPTIONS).errors.phone).toBe(ERR.phone);
  });
});

describe('attendees', () => {
  it('needs at least one', () => {
    expect(validateRsvp(yesPayload({ attendees: [] }), OPTIONS).errors.attendees).toBe(
      ERR.atLeastOneGuest,
    );
  });

  it('caps the party at the configured maximum', () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({
      fullName: `Guest ${'ABCDEFGHI'[i]}`,
      diet: 'meat',
      allergens: [],
    }));
    expect(validateRsvp(yesPayload({ attendees: nine }), OPTIONS).errors.attendees).toBe(
      ERR.tooManyGuests,
    );
  });

  it('reports errors against the specific card that has them', () => {
    const result = validateRsvp(
      yesPayload({
        attendees: [
          { fullName: 'Anna Müller', diet: 'meat', allergens: [] },
          { fullName: '', diet: 'meat', allergens: [] },
          { fullName: 'Jonas Müller', allergens: [] },
        ],
      }),
      OPTIONS,
    );
    expect(result.errors['attendees.1.fullName']).toBe(ERR.required);
    expect(result.errors['attendees.2.diet']).toBe(ERR.choose);
    expect(result.errors['attendees.0.fullName']).toBeUndefined();
  });

  it('rejects the same person entered twice in one party', () => {
    const result = validateRsvp(
      yesPayload({
        attendees: [
          { fullName: 'Anna Müller', diet: 'meat', allergens: [] },
          { fullName: 'anna  muller', diet: 'vegan', allergens: [] },
        ],
        consentHealthData: true,
      }),
      OPTIONS,
    );
    expect(result.errors['attendees.1.fullName']).toBe(ERR.duplicateName);
  });

  it('collapses runs of whitespace in a name', () => {
    const result = validateRsvp(
      yesPayload({ attendees: [{ fullName: 'Anna   van   der  Berg', diet: 'meat', allergens: [] }] }),
      OPTIONS,
    );
    expect(result.value?.attendees[0]!.fullName).toBe('Anna van der Berg');
  });
});

describe('children and age', () => {
  const child = (extra: Record<string, unknown>) =>
    validateRsvp(
      yesPayload({
        attendees: [
          { fullName: 'Anna Müller', diet: 'meat', allergens: [] },
          { fullName: 'Jonas Müller', diet: 'meat', allergens: [], isChild: true, ...extra },
        ],
      }),
      OPTIONS,
    );

  it('requires an age once someone is marked as a child', () => {
    expect(child({}).errors['attendees.1.ageAtEvent']).toBe(ERR.required);
  });

  it.each([18, -1, 99])('rejects an age of %i', (age) => {
    expect(child({ ageAtEvent: age }).errors['attendees.1.ageAtEvent']).toBe(ERR.childAge);
  });

  it.each([0, 4, 17])('accepts an age of %i', (age) => {
    expect(child({ ageAtEvent: age }).errors['attendees.1.ageAtEvent']).toBeUndefined();
  });

  it('rejects a non-integer age', () => {
    expect(child({ ageAtEvent: 4.5 }).errors['attendees.1.ageAtEvent']).toBe(ERR.required);
    expect(child({ ageAtEvent: 'four' }).errors['attendees.1.ageAtEvent']).toBe(ERR.required);
  });

  it('drops a stale age left behind when the child switch is turned back off', () => {
    const result = validateRsvp(
      yesPayload({
        attendees: [{ fullName: 'Anna Müller', diet: 'meat', allergens: [], isChild: false, ageAtEvent: 7 }],
      }),
      OPTIONS,
    );
    expect(result.value?.attendees[0]!.ageAtEvent).toBeNull();
  });

  it('never accepts a date of birth, which is far more sensitive than an age', () => {
    expect(validateRsvp(yesPayload({ birthDate: '2020-03-01' }), OPTIONS).ok).toBe(false);
    expect(validateRsvp(yesPayload({ dob: '2020-03-01' }), OPTIONS).errors.birthDate).toBe(
      ERR.unknownValue,
    );
  });
});

describe('age bands and meal classes', () => {
  const person = (age: number | null, diet: Diet = 'meat', extra = {}) => ({
    fullName: 'X',
    isChild: age !== null,
    ageAtEvent: age,
    diet,
    lactoseFree: false,
    allergens: [] as never[],
    allergenOther: '',
    needsHighchair: false,
    ...extra,
  });

  it.each([
    [0, 'infant'],
    [2, 'infant'],
    [3, 'youngChild'],
    [5, 'youngChild'],
    [6, 'child'],
    [9, 'child'],
    [10, 'tween'],
    [15, 'tween'],
    [16, 'teen'],
    [17, 'teen'],
    [null, 'adult'],
  ])('puts age %s in the %s band', (age, band) => {
    expect(ageBand(person(age))).toBe(band);
  });

  it('charges no meal for under-threes', () => {
    expect(mealClass(person(1))).toBe('infant_no_meal');
    expect(mealClass(person(2, 'vegan'))).toBe('infant_no_meal');
  });

  it('puts three to nines on the kids menu', () => {
    expect(mealClass(person(5, 'vegan'))).toBe('kids_vegan');
    expect(mealClass(person(9, 'vegetarian'))).toBe('kids_vegetarian');
  });

  it('gives tweens, teens and adults an adult portion', () => {
    expect(mealClass(person(12))).toBe('adult_meat');
    expect(mealClass(person(null, 'vegetarian'))).toBe('adult_vegetarian');
  });

  it('flags anything with an allergen so it is never folded into a headcount', () => {
    expect(mealClass(person(null, 'vegetarian', { allergens: ['milk'] }))).toBe(
      'adult_vegetarian_special',
    );
    expect(mealClass(person(null, 'meat', { lactoseFree: true }))).toBe('adult_meat_special');
    expect(mealClass(person(null, 'meat', { allergenOther: 'kiwi' }))).toBe('adult_meat_special');
  });

  it('counts teens as adults for catering but keeps children separate', () => {
    const attendees = [person(null), person(16), person(4), person(1)];
    expect(countAdults(attendees)).toBe(2);
    expect(countChildren(attendees)).toBe(2);
  });
});

describe('diet and allergens', () => {
  it('requires a diet for every attendee', () => {
    expect(
      validateRsvp(yesPayload({ attendees: [{ fullName: 'Anna Müller', allergens: [] }] }), OPTIONS)
        .errors['attendees.0.diet'],
    ).toBe(ERR.choose);
  });

  it('rejects an allergen that is not on the regulated list', () => {
    const result = validateRsvp(
      yesPayload({
        attendees: [{ fullName: 'Anna Müller', diet: 'meat', allergens: ['gluten', 'kryptonite'] }],
        consentHealthData: true,
      }),
      OPTIONS,
    );
    expect(result.errors['attendees.0.allergens']).toBe(ERR.unknownValue);
  });

  it('de-duplicates allergens', () => {
    const result = validateRsvp(
      yesPayload({
        attendees: [{ fullName: 'Anna Müller', diet: 'meat', allergens: ['milk', 'milk'] }],
        consentHealthData: true,
      }),
      OPTIONS,
    );
    expect(result.value?.attendees[0]!.allergens).toEqual(['milk']);
  });

  it('drops lactose-free as redundant for a vegan, without complaining', () => {
    const result = validateRsvp(
      yesPayload({
        attendees: [{ fullName: 'Anna Müller', diet: 'vegan', allergens: [], lactoseFree: true }],
        consentHealthData: true,
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    expect(result.value?.attendees[0]!.lactoseFree).toBe(false);
  });

  it('caps the free-text allergy field', () => {
    const result = validateRsvp(
      yesPayload({
        attendees: [
          { fullName: 'Anna Müller', diet: 'meat', allergens: [], allergenOther: 'x'.repeat(121) },
        ],
        consentHealthData: true,
      }),
      OPTIONS,
    );
    expect(result.errors['attendees.0.allergenOther']).toBe(ERR.tooLong);
  });
});

describe('the Article 9 consent gate', () => {
  it('demands explicit consent once any health data is present', () => {
    for (const attendee of [
      { fullName: 'A B', diet: 'vegan', allergens: [] },
      { fullName: 'A B', diet: 'vegetarian', allergens: [] },
      { fullName: 'A B', diet: 'meat', allergens: ['milk'] },
      { fullName: 'A B', diet: 'meat', allergens: [], lactoseFree: true },
      { fullName: 'A B', diet: 'meat', allergens: [], allergenOther: 'kiwi' },
    ]) {
      const result = validateRsvp(yesPayload({ attendees: [attendee] }), OPTIONS);
      expect(result.errors.consentHealthData, JSON.stringify(attendee)).toBe(ERR.consentHealth);
    }
  });

  it('does not ask for it when there is nothing sensitive to consent to', () => {
    const result = validateRsvp(yesPayload(), OPTIONS);
    expect(result.errors.consentHealthData).toBeUndefined();
    expect(result.value?.consentHealthData).toBe(false);
  });

  it('passes once consent is given', () => {
    const result = validateRsvp(
      yesPayload({
        attendees: [{ fullName: 'Anna Müller', diet: 'vegan', allergens: ['nuts'] }],
        consentHealthData: true,
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    expect(result.value?.consentHealthData).toBe(true);
  });
});

describe('the general privacy consent', () => {
  it('is required on every path, including a decline', () => {
    for (const status of ['yes', 'no', 'maybe']) {
      const result = validateRsvp(yesPayload({ status, consentPrivacy: false }), OPTIONS);
      expect(result.errors.consentPrivacy, status).toBe(ERR.consentPrivacy);
    }
  });
});

describe('hotel', () => {
  const night = EVENT.hotelNights[0]!;

  it('needs at least one night once they say yes', () => {
    expect(
      validateRsvp(yesPayload({ hotelStatus: 'yes', nights: [], roomsRequested: 1 }), OPTIONS)
        .errors.nights,
    ).toBe(ERR.pickANight);
  });

  it('only accepts the three nights the venue offers', () => {
    const result = validateRsvp(
      yesPayload({ hotelStatus: 'yes', nights: ['2027-07-04'], roomsRequested: 1 }),
      OPTIONS,
    );
    expect(result.errors.nights).toBe(ERR.unknownValue);
  });

  it('derives the night count rather than trusting one', () => {
    const result = validateRsvp(
      yesPayload({
        hotelStatus: 'yes',
        nights: [EVENT.hotelNights[1], night, night],
        roomsRequested: 1,
      }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    expect(result.value?.nights).toEqual([night, EVENT.hotelNights[1]]);
  });

  it('clears nights and rooms when they are not staying', () => {
    const result = validateRsvp(
      yesPayload({ hotelStatus: 'no', nights: [night], roomsRequested: 3, cots: 2 }),
      OPTIONS,
    );
    expect(result.value?.nights).toEqual([]);
    expect(result.value?.roomsRequested).toBeNull();
    expect(result.value?.cots).toBe(0);
  });

  it('catches more rooms than there are people', () => {
    const result = validateRsvp(
      yesPayload({ hotelStatus: 'yes', nights: [night], roomsRequested: 4 }),
      OPTIONS,
    );
    expect(result.errors.roomsRequested).toBe(ERR.tooManyRooms);
  });

  it('suggests one room per two adults', () => {
    const adult = { fullName: 'X', isChild: false, ageAtEvent: null } as never;
    expect(suggestedRooms([adult, adult])).toBe(1);
    expect(suggestedRooms([adult, adult, adult])).toBe(2);
    expect(suggestedRooms([adult])).toBe(1);
  });
});

describe('travel and carpooling', () => {
  it('requires a region from someone who needs a lift', () => {
    expect(
      validateRsvp(yesPayload({ travelMode: 'carpool', carpoolShareConsent: true }), OPTIONS).errors
        .carpoolNeedFrom,
    ).toBe(ERR.carpoolRegion);
  });

  it('requires consent before sharing contact details with another guest', () => {
    const needing = validateRsvp(
      yesPayload({ travelMode: 'carpool', carpoolNeedFrom: 'hannover' }),
      OPTIONS,
    );
    expect(needing.errors.carpoolShareConsent).toBe(ERR.carpoolConsent);

    const offering = validateRsvp(
      yesPayload({ travelMode: 'own_car', carpoolOfferSeats: 2 }),
      OPTIONS,
    );
    expect(offering.errors.carpoolShareConsent).toBe(ERR.carpoolConsent);
  });

  it('does not ask for consent when no lift is offered or needed', () => {
    expect(validateRsvp(yesPayload({ travelMode: 'own_car' }), OPTIONS).ok).toBe(true);
  });

  it('ignores offered seats from someone arriving by train', () => {
    const result = validateRsvp(
      yesPayload({ travelMode: 'train_taxi', carpoolOfferSeats: 4 }),
      OPTIONS,
    );
    expect(result.ok).toBe(true);
    expect(result.value?.carpoolOfferSeats).toBe(0);
  });
});

describe('songs and message', () => {
  it('keeps at most three songs', () => {
    const result = validateRsvp(
      yesPayload({
        songs: [
          { title: 'A', artist: 'X' },
          { title: 'B', artist: 'Y' },
          { title: 'C', artist: 'Z' },
          { title: 'D', artist: 'W' },
        ],
      }),
      OPTIONS,
    );
    expect(result.value?.songs).toHaveLength(3);
  });

  it('drops rows the guest never filled in, but keeps a title without an artist', () => {
    const result = validateRsvp(
      yesPayload({
        songs: [{ title: '', artist: '' }, { title: 'Just a title', artist: '' }],
      }),
      OPTIONS,
    );
    expect(result.value?.songs).toEqual([{ title: 'Just a title', artist: '' }]);
  });

  it('caps the message length', () => {
    expect(validateRsvp(yesPayload({ message: 'x'.repeat(501) }), OPTIONS).errors.message).toBe(
      ERR.tooLong,
    );
    expect(validateRsvp(yesPayload({ message: 'x'.repeat(500) }), OPTIONS).ok).toBe(true);
  });
});

describe('partySize', () => {
  it('counts the attendee cards rather than trusting a number', () => {
    expect(
      partySize({ status: 'yes', attendees: [{}, {}, {}] as never, expectedPartySize: 99 }),
    ).toBe(3);
  });

  it('uses the estimate on the "not sure" path', () => {
    expect(partySize({ status: 'maybe', attendees: [], expectedPartySize: 4 })).toBe(4);
  });
});

describe('rsvpPhase', () => {
  const soft = '2026-11-05T23:59:59+01:00';
  const hard = '2026-12-15T23:59:59+01:00';

  it('is open before the soft deadline', () => {
    expect(rsvpPhase('2026-08-14T12:00:00+02:00', soft, hard)).toBe('open');
  });

  it('accepts late answers between the two dates rather than closing the door', () => {
    expect(rsvpPhase('2026-11-20T12:00:00+01:00', soft, hard)).toBe('late');
    expect(isRsvpWritable('late')).toBe(true);
  });

  it('locks after the hard date', () => {
    expect(rsvpPhase('2026-12-16T00:00:01+01:00', soft, hard)).toBe('locked');
    expect(isRsvpWritable('locked')).toBe(false);
  });

  it('is exact on the second at each boundary', () => {
    expect(rsvpPhase(soft, soft, hard)).toBe('open');
    expect(rsvpPhase('2026-11-06T00:00:00+01:00', soft, hard)).toBe('late');
    expect(rsvpPhase(hard, soft, hard)).toBe('late');
  });

  it('reads the real configured dates without complaint', () => {
    expect(['open', 'late', 'locked']).toContain(
      rsvpPhase(new Date(), EVENT.rsvp.softDeadline, EVENT.rsvp.hardLock),
    );
  });
});

describe('a complete valid submission', () => {
  it('passes and comes back normalised', () => {
    const result = validateRsvp(
      yesPayload({
        attendees: [
          { fullName: 'Anna Müller', diet: 'vegetarian', allergens: ['milk'] },
          { fullName: 'Jonas Müller', diet: 'meat', allergens: [], isChild: true, ageAtEvent: 4 },
        ],
        hotelStatus: 'yes',
        nights: [EVENT.hotelNights[0], EVENT.hotelNights[1]],
        roomsRequested: 1,
        cots: 1,
        travelMode: 'own_car',
        carpoolOfferSeats: 2,
        carpoolShareConsent: true,
        consentHealthData: true,
        songs: [{ title: 'Dancing Queen', artist: 'ABBA' }],
        message: 'So happy for you both.',
      }),
      OPTIONS,
    );

    expect(result.errors).toEqual({});
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({
      status: 'yes',
      email: 'anna@example.com',
      phone: '+491701234567',
      cots: 1,
      roomsRequested: 1,
      carpoolOfferSeats: 2,
      consentHealthData: true,
    });
    expect(result.value?.nights).toHaveLength(2);
    expect(partySize(result.value!)).toBe(2);
    expect(mealClass(result.value!.attendees[0]!)).toBe('adult_vegetarian_special');
    expect(mealClass(result.value!.attendees[1]!)).toBe('kids_meat');
  });
});
