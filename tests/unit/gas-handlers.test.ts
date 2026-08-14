import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchGet,
  dispatchPost,
  editUrl,
  type BackendConfig,
  type Deps,
  type PartyRow,
  type SheetPort,
  type SubmissionEntry,
} from '../../gas/src/handlers';
import { renderConfirmationEmail } from '../../gas/src/mail';
import {
  HANDOFF_COLUMNS,
  HOTEL_COLUMNS,
  attendeeRows,
  cateringSummary,
  handoffRows,
  hotelRows,
  parseResponseRow,
  responseRow,
  RESPONSE_COLUMNS,
} from '../../gas/src/sheet';

/**
 * The backend is tested against an in-memory sheet rather than a real one.
 * `clasp run` in CI would be slow, flaky and need credentials; the handlers are
 * dependency-injected precisely so this is possible.
 *
 * What this cannot cover — OAuth scopes, the deployment settings and CORS —
 * only fails for real, so there is a manual smoke test before launch.
 */

const CONFIG: BackendConfig = {
  softDeadline: '2026-11-05T23:59:59+01:00',
  hardLock: '2026-12-15T23:59:59+01:00',
  eventAt: '2027-06-11T11:00:00+02:00',
  hotelNights: ['2027-06-10', '2027-06-11', '2027-06-12'],
  inviteCode: 'GROHNDE27',
  siteOrigin: 'https://example.test',
  replyTo: 'couple@example.test',
  coupleNames: 'Mara & Terry',
};

class FakeSheet implements SheetPort {
  rows: PartyRow[] = [];
  submissions: SubmissionEntry[] = [];

  findByToken(token: string) {
    return this.rows.find((r) => r.token === token) ?? null;
  }
  findByEmail(email: string) {
    return this.rows.find((r) => r.email === email) ?? null;
  }
  allNames() {
    return this.rows.flatMap((r) => r.payload.attendees.map((a) => ({ token: r.token, name: a.fullName })));
  }
  insert(row: PartyRow) {
    this.rows.push(row);
  }
  update(row: PartyRow) {
    const i = this.rows.findIndex((r) => r.token === row.token);
    if (i >= 0) this.rows[i] = row;
  }
  appendSubmission(entry: SubmissionEntry) {
    this.submissions.push(entry);
  }
}

let sheet: FakeSheet;
let sent: Array<{ to: string; subject: string; body: string }>;
let uuidCounter: number;
let clock: string;

function makeDeps(overrides: Partial<Deps> = {}): Deps {
  return {
    sheet,
    mailer: { send: (message) => sent.push(message) },
    config: () => CONFIG,
    now: () => new Date(clock),
    uuid: () => `token-${(uuidCounter += 1)}`,
    lock: (fn) => fn(),
    renderEmail: renderConfirmationEmail,
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
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
    inviteCode: 'GROHNDE27',
    inviteCodeValid: true,
    locale: 'en',
    ...overrides,
  };
}

const create = (deps: Deps, overrides: Record<string, unknown> = {}, locale = 'en') =>
  dispatchPost(deps, { action: 'create', locale, payload: payload(overrides) });

beforeEach(() => {
  sheet = new FakeSheet();
  sent = [];
  uuidCounter = 0;
  clock = '2026-08-14T12:00:00+02:00';
});

describe('status', () => {
  it('reports the phase and the dates the form runs on', () => {
    const result = dispatchGet(makeDeps(), { action: 'status' });
    expect(result).toMatchObject({ ok: true, phase: 'open', open: true, eventAt: CONFIG.eventAt });
  });

  it('follows the config through each phase', () => {
    clock = '2026-11-20T12:00:00+01:00';
    expect(dispatchGet(makeDeps(), { action: 'status' })).toMatchObject({ phase: 'late', open: true });
    clock = '2026-12-20T12:00:00+01:00';
    expect(dispatchGet(makeDeps(), { action: 'status' })).toMatchObject({ phase: 'locked', open: false });
  });
});

describe('create', () => {
  it('stores the reply and hands back a token, party code and edit link', () => {
    const result = create(makeDeps());
    expect(result.ok).toBe(true);
    expect(result.token).toBe('token-1');
    expect(result.partyCode).toMatch(/^MT-[A-Z2-9]{6}$/);
    expect(result.editUrl).toBe('https://example.test/rsvp/edit?t=token-1');
    expect(sheet.rows).toHaveLength(1);
  });

  it('writes an append-only submission alongside the row', () => {
    create(makeDeps());
    expect(sheet.submissions).toHaveLength(1);
    expect(sheet.submissions[0]).toMatchObject({ action: 'create', version: 1, token: 'token-1' });
  });

  it('sends a confirmation containing the edit link', () => {
    create(makeDeps());
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('anna@example.com');
    expect(sent[0]!.body).toContain('https://example.test/rsvp/edit?t=token-1');
  });

  it('puts the party code in the email so it survives losing the page', () => {
    const result = create(makeDeps());
    expect(sent[0]!.body).toContain(String(result.partyCode));
  });

  it('rejects an invalid payload with per-field errors', () => {
    const result = dispatchPost(makeDeps(), {
      action: 'create',
      payload: payload({ email: 'nope', attendees: [] }),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('VALIDATION');
    expect(result.fields).toMatchObject({ email: expect.any(String) });
    expect(sheet.rows).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it('stamps a reply between the two deadlines as late, but still accepts it', () => {
    clock = '2026-11-20T12:00:00+01:00';
    const result = create(makeDeps());
    expect(result.ok).toBe(true);
    expect(sheet.rows[0]!.late).toBe(true);
  });

  it('refuses to write after the hard lock, whatever the client thinks', () => {
    clock = '2026-12-20T12:00:00+01:00';
    const result = create(makeDeps());
    expect(result).toMatchObject({ ok: false, error: 'CLOSED' });
    expect(sheet.rows).toHaveLength(0);
  });

  it('swallows a honeypot submission without storing or emailing anything', () => {
    const result = dispatchPost(makeDeps(), {
      action: 'create',
      hp: 'i am a robot',
      payload: payload(),
    });
    // Looks like success, so the bot learns nothing.
    expect(result.ok).toBe(true);
    expect(sheet.rows).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it('records a missing invitation code rather than refusing the reply', () => {
    const result = create(makeDeps(), { inviteCode: 'WRONG', inviteCodeValid: false });
    expect(result.ok).toBe(true);
    expect(sheet.rows[0]!.payload.inviteCodeValid).toBe(false);
    expect(sheet.rows[0]!.payload.inviteCode).toBe('WRONG');
  });

  it('returns the existing link when the same address replies twice', () => {
    const first = create(makeDeps());
    const second = create(makeDeps(), { leadFirstName: 'Someone', attendees: [{ fullName: 'Someone Else', diet: 'meat', allergens: [] }] });

    expect(second.duplicate).toBe(true);
    expect(second.token).toBe(first.token);
    expect(sheet.rows).toHaveLength(1);
    // And they get the link again, so it is a recovery path, not a dead end.
    expect(sent).toHaveLength(2);
  });

  it('flags a name that already appears in another party, without blocking it', () => {
    create(makeDeps());
    const result = create(makeDeps(), {
      email: 'other@example.com',
      attendees: [{ fullName: 'anna  MULLER', diet: 'meat', allergens: [] }],
    });
    expect(result.ok).toBe(true);
    expect(sheet.rows[1]!.possibleDuplicate).toBe(true);
  });

  it('keeps the reply even if the email fails to send', () => {
    const deps = makeDeps({
      mailer: {
        send: () => {
          throw new Error('Gmail is having a day');
        },
      },
      log: vi.fn(),
    });
    const result = create(deps);
    // Losing a stored answer because a mail server hiccuped would be far worse
    // than a guest not getting a receipt.
    expect(result.ok).toBe(true);
    expect(sheet.rows).toHaveLength(1);
    expect(deps.log).toHaveBeenCalled();
  });

  it('builds a localized edit link', () => {
    dispatchPost(makeDeps(), { action: 'create', locale: 'de', payload: payload({ locale: 'de' }) });
    expect(sheet.rows[0]!.locale).toBe('de');
    expect(editUrl('token-1', 'de', CONFIG.siteOrigin)).toBe(
      'https://example.test/de/rsvp/edit?t=token-1',
    );
  });
});

describe('get', () => {
  it('returns the reply for a valid token', () => {
    create(makeDeps());
    const result = dispatchGet(makeDeps(), { action: 'get', t: 'token-1' });
    expect(result.ok).toBe(true);
    expect((result.rsvp as PartyRow).payload.leadFirstName).toBe('Anna');
  });

  it('never sends the token back inside the record', () => {
    create(makeDeps());
    const result = dispatchGet(makeDeps(), { action: 'get', t: 'token-1' });
    expect(result.rsvp).not.toHaveProperty('token');
  });

  it('answers identically for an unknown and a malformed token', () => {
    create(makeDeps());
    const unknown = dispatchGet(makeDeps(), { action: 'get', t: 'token-999' });
    const malformed = dispatchGet(makeDeps(), { action: 'get', t: '<script>' });
    const empty = dispatchGet(makeDeps(), { action: 'get', t: '' });
    expect(unknown).toEqual({ ok: false, error: 'NOT_FOUND' });
    expect(malformed).toEqual(unknown);
    expect(empty).toEqual(unknown);
  });

  it('marks the record read-only once the form has locked', () => {
    create(makeDeps());
    clock = '2026-12-20T12:00:00+01:00';
    const result = dispatchGet(makeDeps(), { action: 'get', t: 'token-1' });
    // Still readable — a guest can always see what they said.
    expect(result.ok).toBe(true);
    expect(result.readOnly).toBe(true);
  });
});

describe('update', () => {
  it('saves the change and bumps the version', () => {
    create(makeDeps());
    const result = dispatchPost(makeDeps(), {
      action: 'update',
      token: 'token-1',
      payload: payload({ eveningParty: 'no' }),
    });
    expect(result.ok).toBe(true);
    expect(sheet.rows[0]!.version).toBe(2);
    expect(sheet.rows[0]!.payload.eveningParty).toBe('no');
  });

  it('keeps every version in the log, so nothing is ever really lost', () => {
    create(makeDeps());
    dispatchPost(makeDeps(), { action: 'update', token: 'token-1', payload: payload({ eveningParty: 'no' }) });
    dispatchPost(makeDeps(), { action: 'update', token: 'token-1', payload: payload({ eveningParty: 'unsure' }) });
    expect(sheet.submissions.map((s) => s.version)).toEqual([1, 2, 3]);
    expect(sheet.submissions[1]!.payload.eveningParty).toBe('no');
  });

  it('refuses an unknown token', () => {
    const result = dispatchPost(makeDeps(), { action: 'update', token: 'nope', payload: payload() });
    expect(result).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('will not let one guest overwrite another party', () => {
    create(makeDeps());
    create(makeDeps(), { email: 'other@example.com' });
    dispatchPost(makeDeps(), {
      action: 'update',
      token: 'token-1',
      payload: payload({ leadFirstName: 'Hacked' }),
    });
    expect(sheet.rows[1]!.payload.leadFirstName).toBe('Anna');
  });

  it('refuses to write after the hard lock', () => {
    create(makeDeps());
    clock = '2026-12-20T12:00:00+01:00';
    const result = dispatchPost(makeDeps(), { action: 'update', token: 'token-1', payload: payload() });
    expect(result).toMatchObject({ ok: false, error: 'CLOSED' });
    expect(sheet.rows[0]!.version).toBe(1);
  });

  it('warns about the change only on an edit, not on the first email', () => {
    create(makeDeps());
    dispatchPost(makeDeps(), { action: 'update', token: 'token-1', payload: payload() });
    expect(sent[0]!.body).not.toContain('not made by you');
    expect(sent[1]!.body).toContain('not made by you');
  });
});

describe('resend', () => {
  it('answers identically whether or not the address is known', () => {
    create(makeDeps());
    const known = dispatchPost(makeDeps(), { action: 'resend', email: 'anna@example.com' });
    const unknown = dispatchPost(makeDeps(), { action: 'resend', email: 'nobody@example.com' });
    expect(known).toEqual({ ok: true });
    expect(unknown).toEqual(known);
  });

  it('sends only to the stored address, never to what was typed', () => {
    create(makeDeps());
    sent = [];
    dispatchPost(makeDeps(), { action: 'resend', email: 'ANNA@example.com' });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('anna@example.com');
  });
});

describe('find (getting back in with the party code)', () => {
  it('returns the token when the code and email both match', () => {
    const created = create(makeDeps());
    const result = dispatchPost(makeDeps(), {
      action: 'find',
      email: 'anna@example.com',
      partyCode: created.partyCode,
    });
    expect(result.ok).toBe(true);
    expect(result.token).toBe(created.token);
  });

  it('accepts the code however the guest types it', () => {
    const created = create(makeDeps());
    const messy = String(created.partyCode).toLowerCase().replace('-', ' ');
    expect(dispatchPost(makeDeps(), { action: 'find', email: 'anna@example.com', partyCode: messy }).ok).toBe(true);
  });

  it('refuses the code on its own, with the wrong address', () => {
    const created = create(makeDeps());
    const result = dispatchPost(makeDeps(), {
      action: 'find',
      email: 'someone-else@example.com',
      partyCode: created.partyCode,
    });
    // Six characters is walkable by a script; the pairing is what makes it safe.
    expect(result).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('refuses the address on its own, with the wrong code', () => {
    create(makeDeps());
    const result = dispatchPost(makeDeps(), {
      action: 'find',
      email: 'anna@example.com',
      partyCode: 'MT-ZZZZZZ',
    });
    expect(result).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('answers identically for every kind of miss, so it reveals nothing', () => {
    create(makeDeps());
    const shapes = [
      { email: 'anna@example.com', partyCode: '' },
      { email: '', partyCode: 'MT-ABCDEF' },
      { email: 'nobody@example.com', partyCode: 'MT-ABCDEF' },
      { email: 'anna@example.com', partyCode: 'nonsense' },
    ];
    for (const shape of shapes) {
      expect(dispatchPost(makeDeps(), { action: 'find', ...shape }), JSON.stringify(shape)).toEqual({
        ok: false,
        error: 'NOT_FOUND',
      });
    }
  });

  it('sends no email — it hands the token straight back', () => {
    const created = create(makeDeps());
    sent = [];
    dispatchPost(makeDeps(), {
      action: 'find',
      email: 'anna@example.com',
      partyCode: created.partyCode,
    });
    expect(sent).toHaveLength(0);
  });
});

describe('unknown actions', () => {
  it('are refused rather than guessed at', () => {
    expect(dispatchGet(makeDeps(), { action: 'drop' })).toMatchObject({ error: 'UNKNOWN_ACTION' });
    expect(dispatchPost(makeDeps(), { action: 'delete' })).toMatchObject({ error: 'UNKNOWN_ACTION' });
  });
});

describe('sheet row round-trip', () => {
  it('survives being written out and read back', () => {
    create(makeDeps(), {
      attendees: [
        { fullName: 'Anna Müller', diet: 'vegetarian', allergens: ['milk'] },
        { fullName: 'Jonas Müller', diet: 'meat', allergens: [], isChild: true, ageAtEvent: 4 },
      ],
      consentHealthData: true,
      hotelStatus: 'yes',
      nights: ['2027-06-10'],
      roomsRequested: 1,
    });
    const original = sheet.rows[0]!;
    const restored = parseResponseRow(responseRow(original, CONFIG.siteOrigin));
    expect(restored).not.toBeNull();
    expect(restored!.token).toBe(original.token);
    expect(restored!.payload).toEqual(original.payload);
  });

  it('shouts about a missing invitation code in a column the couple will scan', () => {
    create(makeDeps(), { inviteCodeValid: false, inviteCode: '' });
    const row = responseRow(sheet.rows[0]!, CONFIG.siteOrigin);
    expect(row[RESPONSE_COLUMNS.indexOf('codeValid')]).toBe('NO CODE');
  });
});

describe('vendor hand-offs are redacted', () => {
  beforeEach(() => {
    create(makeDeps(), {
      attendees: [
        { fullName: 'Anna Müller', diet: 'vegetarian', allergens: ['milk'] },
        { fullName: 'Jonas Müller', diet: 'meat', allergens: [], isChild: true, ageAtEvent: 2 },
      ],
      consentHealthData: true,
      hotelStatus: 'yes',
      nights: ['2027-06-10', '2027-06-11'],
      roomsRequested: 1,
      cots: 1,
      message: 'A private note to the couple',
    });
  });

  it('sends the caterer no surnames, contacts, tokens or messages', () => {
    // The privacy notice promises this. Asserting it means the promise cannot
    // quietly stop being true.
    for (const column of HANDOFF_COLUMNS) {
      expect(column).not.toMatch(/email|phone|token|last_?name|surname|message/i);
    }
    const flat = JSON.stringify(handoffRows(sheet.rows));
    expect(flat).not.toContain('Müller');
    expect(flat).not.toContain('anna@example.com');
    expect(flat).not.toContain('A private note');
    expect(flat).not.toContain('token-1');
  });

  it('still gives the caterer what they need to cook', () => {
    const rows = handoffRows(sheet.rows);
    const flat = JSON.stringify(rows);
    expect(rows).toHaveLength(2);
    expect(flat).toContain('Anna');
    expect(flat).toContain('adult_vegetarian_special');
    expect(flat).toContain('infant_no_meal');
    expect(flat).toContain('milk');
  });

  it('sends the hotel nothing about what anybody eats', () => {
    for (const column of HOTEL_COLUMNS) {
      expect(column).not.toMatch(/diet|alg_|allergen|meal|message|song/i);
    }
    const flat = JSON.stringify(hotelRows(sheet.rows));
    expect(flat).not.toContain('vegetarian');
    expect(flat).not.toContain('milk');
    expect(flat).not.toContain('A private note');
  });

  it('still gives the hotel what they need to allocate rooms', () => {
    const rows = hotelRows(sheet.rows);
    expect(rows).toHaveLength(1);
    const flat = JSON.stringify(rows);
    expect(flat).toContain('Müller');
    expect(flat).toContain('2027-06-10');
  });

  it('omits parties who are not staying', () => {
    create(makeDeps(), { email: 'no-room@example.com', hotelStatus: 'no' });
    expect(hotelRows(sheet.rows)).toHaveLength(1);
  });
});

describe('catering summary', () => {
  it('separates the day headcount from the evening one', () => {
    create(makeDeps(), { eveningParty: 'yes' });
    create(makeDeps(), {
      email: 'day@example.com',
      eveningParty: 'no',
      attendees: [
        { fullName: 'Bo Lee', diet: 'meat', allergens: [] },
        { fullName: 'Kim Lee', diet: 'meat', allergens: [] },
      ],
    });

    const summary = cateringSummary(sheet.rows);
    const find = (label: string) => summary.find((r) => r[0] === label)?.[1];
    // The difference between these two is money, so they are never merged.
    expect(find('Day total (from 12:30)')).toBe(3);
    expect(find('Evening total (from 18:00)')).toBe(1);
  });

  it('lists each allergen with the names behind it', () => {
    create(makeDeps(), {
      attendees: [{ fullName: 'Anna Müller', diet: 'meat', allergens: ['nuts'] }],
      consentHealthData: true,
    });
    const summary = cateringSummary(sheet.rows);
    const nuts = summary.find((r) => r[0] === 'nuts');
    expect(nuts).toBeDefined();
    expect(nuts![1]).toBe(1);
    expect(String(nuts![2])).toContain('Anna');
  });
});

describe('attendee export', () => {
  it('produces one row per person, with the derived catering fields', () => {
    create(makeDeps(), {
      attendees: [
        { fullName: 'Anna Müller', diet: 'vegan', allergens: [] },
        { fullName: 'Jonas Müller', diet: 'meat', allergens: [], isChild: true, ageAtEvent: 7 },
      ],
      consentHealthData: true,
    });
    const rows = attendeeRows(sheet.rows);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('adult_vegan');
    expect(rows[1]).toContain('kids_meat');
    expect(rows[1]).toContain('child');
  });

  it('leaves out parties who declined', () => {
    dispatchPost(makeDeps(), {
      action: 'create',
      payload: {
        status: 'no',
        leadFirstName: 'Bo',
        leadLastName: 'Lee',
        email: 'bo@example.com',
        consentPrivacy: true,
      },
    });
    expect(attendeeRows(sheet.rows)).toHaveLength(0);
  });
});

describe('confirmation email', () => {
  it('is written in the language the guest used', () => {
    for (const [locale, marker] of [
      ['en', 'Hello'],
      ['de', 'Hallo'],
      ['pt', 'Oi,'],
    ] as const) {
      sheet = new FakeSheet();
      sent = [];
      uuidCounter = 0;
      dispatchPost(makeDeps(), { action: 'create', locale, payload: payload({ locale }) });
      expect(sent[0]!.body, locale).toContain(marker);
    }
  });

  it('reads the answers back so a mis-tap is caught before the couple chase it', () => {
    create(makeDeps(), {
      attendees: [
        { fullName: 'Anna Müller', diet: 'vegan', allergens: ['nuts'] },
        { fullName: 'Jonas Müller', diet: 'meat', allergens: [], isChild: true, ageAtEvent: 4 },
      ],
      consentHealthData: true,
      hotelStatus: 'yes',
      nights: ['2027-06-10'],
      roomsRequested: 1,
    });
    const body = sent[0]!.body;
    expect(body).toContain('Anna Müller, Jonas Müller');
    expect(body).toContain('vegan');
    expect(body).toContain('nuts');
  });

  it('keeps the link on its own line so it survives a copy-paste', () => {
    create(makeDeps());
    const lines = sent[0]!.body.split('\n');
    expect(lines).toContain('https://example.test/rsvp/edit?t=token-1');
  });

  it('says something warm rather than nothing to a guest who declined', () => {
    dispatchPost(makeDeps(), {
      action: 'create',
      payload: {
        status: 'no',
        leadFirstName: 'Bo',
        leadLastName: 'Lee',
        email: 'bo@example.com',
        consentPrivacy: true,
      },
    });
    expect(sent[0]!.body).toContain('miss you');
    // No party code for someone who is not coming.
    expect(sent[0]!.body).not.toMatch(/MT-[A-Z2-9]{6}/);
  });
});
