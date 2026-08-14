/**
 * Google Sheet adapter.
 *
 * The sheet is both the database and the thing the couple actually open, so
 * every answer is written out into readable columns *and* kept verbatim as JSON
 * in the last column. The flattened columns are what you sort and filter; the
 * JSON is what survives a schema change, so adding a question later never
 * orphans the replies already collected.
 */

import type { PartyRow, SheetPort } from './handlers.ts';
import {
  ageBand,
  countAdults,
  countChildren,
  mealClass,
  type RsvpPayload,
} from '../../src/lib/rsvp/model.ts';

export const TABS = {
  responses: 'Responses',
  submissions: 'Submissions',
  config: 'Config',
  attendees: 'Attendees',
  catering: 'CateringSummary',
  hotel: 'HotelBlock',
  handoff: 'CateringHandoff',
} as const;

/** Column order for the Responses tab. Header and row builder derive from this. */
export const RESPONSE_COLUMNS = [
  'token',
  'partyCode',
  'submittedAt',
  'updatedAt',
  'version',
  'late',
  'status',
  'firstName',
  'lastName',
  'email',
  'phone',
  'whatsapp',
  'locale',
  'adults',
  'children',
  'total',
  'eveningParty',
  'hotelStatus',
  'nights',
  'rooms',
  'cots',
  'travelMode',
  'carpoolSeats',
  'carpoolFrom',
  'carpoolConsent',
  'inviteCode',
  'codeValid',
  'songs',
  'message',
  'possibleDuplicate',
  'emailBounced',
  'editUrl',
  'payloadJson',
] as const;

export function responseRow(row: PartyRow, siteOrigin: string): unknown[] {
  const p = row.payload;
  const prefix = row.locale && row.locale !== 'en' ? `/${row.locale}` : '';
  return [
    row.token,
    row.partyCode,
    row.submittedAt,
    row.updatedAt,
    row.version,
    row.late ? 'YES' : '',
    p.status,
    p.leadFirstName,
    p.leadLastName,
    p.email,
    p.phone,
    p.phoneIsWhatsapp ? 'yes' : '',
    row.locale,
    countAdults(p.attendees),
    countChildren(p.attendees),
    p.attendees.length || p.expectedPartySize || 0,
    p.eveningParty ?? '',
    p.hotelStatus ?? '',
    p.nights.join(', '),
    p.roomsRequested ?? '',
    p.cots,
    p.travelMode ?? '',
    p.carpoolOfferSeats,
    p.carpoolNeedFrom ?? '',
    p.carpoolShareConsent ? 'yes' : '',
    p.inviteCode,
    // Loud on purpose: this is the column the couple should scan.
    p.inviteCodeValid ? 'ok' : 'NO CODE',
    p.songs.map((s) => [s.title, s.artist].filter(Boolean).join(' — ')).join(' | '),
    p.message,
    row.possibleDuplicate ? 'CHECK' : '',
    row.emailBounced ? 'BOUNCED' : '',
    `${siteOrigin.replace(/\/$/, '')}${prefix}/rsvp/edit?t=${row.token}`,
    JSON.stringify(p),
  ];
}

/** Rebuild a PartyRow from a sheet row. The JSON column is the source of truth. */
export function parseResponseRow(values: unknown[]): PartyRow | null {
  const index = (name: (typeof RESPONSE_COLUMNS)[number]) => RESPONSE_COLUMNS.indexOf(name);
  const token = String(values[index('token')] ?? '');
  if (!token) return null;

  let payload: RsvpPayload;
  try {
    payload = JSON.parse(String(values[index('payloadJson')] ?? '{}')) as RsvpPayload;
  } catch {
    return null;
  }

  return {
    token,
    partyCode: String(values[index('partyCode')] ?? ''),
    email: String(values[index('email')] ?? '').toLowerCase(),
    locale: String(values[index('locale')] ?? 'en'),
    payload,
    late: String(values[index('late')] ?? '') === 'YES',
    version: Number(values[index('version')] ?? 1),
    submittedAt: String(values[index('submittedAt')] ?? ''),
    updatedAt: String(values[index('updatedAt')] ?? ''),
    emailBounced: String(values[index('emailBounced')] ?? '') === 'BOUNCED',
    possibleDuplicate: String(values[index('possibleDuplicate')] ?? '') === 'CHECK',
  };
}

// ---------------------------------------------------------------------------
// Derived export views
// ---------------------------------------------------------------------------

export const ATTENDEE_COLUMNS = [
  'partyCode',
  'lastName',
  'seq',
  'fullName',
  'isChild',
  'ageAtEvent',
  'ageBand',
  'diet',
  'lactoseFree',
  'allergens',
  'allergenOther',
  'needsHighchair',
  'mealClass',
  'eveningParty',
] as const;

export function attendeeRows(rows: PartyRow[]): unknown[][] {
  const out: unknown[][] = [];
  for (const row of rows) {
    if (row.payload.status !== 'yes') continue;
    row.payload.attendees.forEach((a, i) => {
      out.push([
        row.partyCode,
        row.payload.leadLastName,
        i + 1,
        a.fullName,
        a.isChild ? 'child' : 'adult',
        a.ageAtEvent ?? '',
        ageBand(a),
        a.diet,
        a.lactoseFree ? 'yes' : '',
        a.allergens.join(', '),
        a.allergenOther,
        a.needsHighchair ? 'yes' : '',
        mealClass(a),
        row.payload.eveningParty ?? '',
      ]);
    });
  }
  return out;
}

/**
 * Goes to the hotel. Rooms and nights only — the hotel has no business knowing
 * what anybody eats.
 */
export const HOTEL_COLUMNS = [
  'partyCode',
  'lastName',
  'firstName',
  'email',
  'phone',
  'adults',
  'children',
  'childAges',
  'rooms',
  'cots',
  'nights',
  'nightCount',
] as const;

export function hotelRows(rows: PartyRow[]): unknown[][] {
  return rows
    .filter((row) => row.payload.hotelStatus === 'yes')
    .map((row) => {
      const p = row.payload;
      return [
        row.partyCode,
        p.leadLastName,
        p.leadFirstName,
        p.email,
        p.phone,
        countAdults(p.attendees),
        countChildren(p.attendees),
        p.attendees
          .filter((a) => a.isChild)
          .map((a) => a.ageAtEvent)
          .join(', '),
        p.roomsRequested ?? 1,
        p.cots,
        p.nights.join(', '),
        p.nights.length,
      ];
    });
}

/**
 * Goes to the caterer. First names only, no surnames, no contact details — the
 * kitchen needs to know what to cook, not who everybody is. This is the data
 * minimisation the privacy notice promises, so the redaction is asserted by a
 * regression test rather than left to good intentions.
 */
export const HANDOFF_COLUMNS = [
  'seat',
  'firstName',
  'ageBand',
  'mealClass',
  'lactoseFree',
  'allergens',
  'allergenOther',
  'needsHighchair',
  'eveningOnly',
] as const;

export function handoffRows(rows: PartyRow[]): unknown[][] {
  const out: unknown[][] = [];
  let seat = 0;
  for (const row of rows) {
    if (row.payload.status !== 'yes') continue;
    for (const a of row.payload.attendees) {
      seat += 1;
      out.push([
        seat,
        a.fullName.split(' ')[0] ?? '',
        ageBand(a),
        mealClass(a),
        a.lactoseFree ? 'yes' : '',
        a.allergens.join(', '),
        a.allergenOther,
        a.needsHighchair ? 'yes' : '',
        row.payload.eveningParty === 'no' ? 'day only' : '',
      ]);
    }
  }
  return out;
}

/** The one-pager the kitchen actually works from. */
export function cateringSummary(rows: PartyRow[]): unknown[][] {
  const counts = new Map<string, number>();
  const allergenCounts = new Map<string, string[]>();
  let highchairs = 0;
  let evening = 0;
  let day = 0;

  for (const row of rows) {
    if (row.payload.status !== 'yes') continue;
    const staysForEvening = row.payload.eveningParty !== 'no';
    for (const a of row.payload.attendees) {
      const key = mealClass(a);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (a.needsHighchair) highchairs += 1;
      day += 1;
      if (staysForEvening) evening += 1;
      for (const allergen of a.allergens) {
        allergenCounts.set(allergen, [
          ...(allergenCounts.get(allergen) ?? []),
          a.fullName.split(' ')[0] ?? '',
        ]);
      }
      if (a.lactoseFree) {
        allergenCounts.set('lactose-free', [
          ...(allergenCounts.get('lactose-free') ?? []),
          a.fullName.split(' ')[0] ?? '',
        ]);
      }
    }
  }

  const out: unknown[][] = [['Meal class', 'Count', 'Names']];
  for (const [key, count] of [...counts.entries()].sort()) out.push([key, count, '']);
  out.push([], ['Day total (from 12:30)', day, '']);
  // These two differ, and the difference is money.
  out.push(['Evening total (from 18:00)', evening, '']);
  out.push(['High chairs', highchairs, '']);
  out.push([], ['Allergen', 'Count', 'Names']);
  for (const [allergen, names] of [...allergenCounts.entries()].sort()) {
    out.push([allergen, names.length, names.join(', ')]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The live adapter (only runs inside Apps Script)
// ---------------------------------------------------------------------------

declare const SpreadsheetApp: any;

export function createSheetPort(siteOrigin: string): SheetPort {
  const book = SpreadsheetApp.getActiveSpreadsheet();

  const tab = (name: string, headers?: readonly string[]) => {
    let sheet = book.getSheetByName(name);
    if (!sheet) {
      sheet = book.insertSheet(name);
      if (headers) {
        sheet.appendRow([...headers]);
        sheet.setFrozenRows(1);
      }
    }
    return sheet;
  };

  const responses = () => tab(TABS.responses, RESPONSE_COLUMNS);

  const readAll = (): Array<{ rowIndex: number; row: PartyRow }> => {
    const sheet = responses();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    const values = sheet.getRange(2, 1, lastRow - 1, RESPONSE_COLUMNS.length).getValues();
    const out: Array<{ rowIndex: number; row: PartyRow }> = [];
    values.forEach((values: unknown[], i: number) => {
      const parsed = parseResponseRow(values);
      if (parsed) out.push({ rowIndex: i + 2, row: parsed });
    });
    return out;
  };

  return {
    findByToken(token) {
      return readAll().find((entry) => entry.row.token === token)?.row ?? null;
    },
    findByEmail(email) {
      return readAll().find((entry) => entry.row.email === email)?.row ?? null;
    },
    allNames() {
      return readAll().flatMap((entry) =>
        entry.row.payload.attendees.map((a) => ({ token: entry.row.token, name: a.fullName })),
      );
    },
    insert(row) {
      responses().appendRow(responseRow(row, siteOrigin));
    },
    update(row) {
      const match = readAll().find((entry) => entry.row.token === row.token);
      if (!match) return;
      responses()
        .getRange(match.rowIndex, 1, 1, RESPONSE_COLUMNS.length)
        .setValues([responseRow(row, siteOrigin)]);
    },
    appendSubmission(entry) {
      const sheet = tab(TABS.submissions, ['at', 'token', 'action', 'version', 'payloadJson']);
      sheet.appendRow([entry.at, entry.token, entry.action, entry.version, JSON.stringify(entry.payload)]);
    },
  };
}
