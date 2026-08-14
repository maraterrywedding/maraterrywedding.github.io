/**
 * RSVP backend logic.
 *
 * Everything here is pure apart from what arrives through `Deps`, so the whole
 * thing can be exercised by Vitest against an in-memory fake sheet. `main.ts`
 * is a thin adapter that binds the real SpreadsheetApp / MailApp / LockService
 * globals — nothing in this file knows those exist.
 *
 * This is the authoritative side. `validateRsvp` here is the very same module
 * the browser form imports, so the two cannot disagree about what a valid
 * submission looks like, and a guest holding the raw endpoint URL is checked
 * by exactly the same rules.
 */

// Explicit .ts extensions: this module is consumed three ways — bundled by
// esbuild for Apps Script, imported by Vitest, and run directly by Node for the
// mock server. Only Node's native ESM resolver insists on the extension, and it
// is harmless to the other two.
import { validateRsvp, rsvpPhase, type RsvpPhase } from '../../src/lib/rsvp/validate.ts';
import { normalizeInviteCode, normalizePartyCode, partyCode } from '../../src/lib/rsvp/invite.ts';
import type { RsvpPayload } from '../../src/lib/rsvp/model.ts';

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

export interface BackendConfig {
  softDeadline: string;
  hardLock: string;
  eventAt: string;
  hotelNights: string[];
  inviteCode: string;
  siteOrigin: string;
  /** Where guests should reply; also the From address Apps Script sends as. */
  replyTo: string;
  coupleNames: string;
}

export interface PartyRow {
  token: string;
  partyCode: string;
  email: string;
  locale: string;
  payload: RsvpPayload;
  /** Submitted after the soft deadline. */
  late: boolean;
  version: number;
  submittedAt: string;
  updatedAt: string;
  /** Set by hand when a confirmation email bounces. */
  emailBounced: boolean;
  /** A name in this party matches one in another party. For the couple to check. */
  possibleDuplicate: boolean;
}

export interface SubmissionEntry {
  at: string;
  token: string;
  action: 'create' | 'update';
  version: number;
  payload: RsvpPayload;
}

export interface SheetPort {
  findByToken(token: string): PartyRow | null;
  findByEmail(email: string): PartyRow | null;
  /** Every attendee name across every party, for duplicate detection. */
  allNames(): Array<{ token: string; name: string }>;
  insert(row: PartyRow): void;
  update(row: PartyRow): void;
  appendSubmission(entry: SubmissionEntry): void;
}

export interface MailerPort {
  send(message: { to: string; subject: string; body: string; replyTo: string }): void;
}

export interface Deps {
  sheet: SheetPort;
  mailer: MailerPort;
  config: () => BackendConfig;
  now: () => Date;
  uuid: () => string;
  /** Serialises writes; concurrent appends to a sheet otherwise interleave. */
  lock: <T>(fn: () => T) => T;
  /** Renders the confirmation email for a party. */
  renderEmail: (row: PartyRow, config: BackendConfig) => { subject: string; body: string };
  /** Somewhere to note a failure without taking the request down with it. */
  log?: (message: string) => void;
}

export type ApiResponse = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function editUrl(token: string, locale: string, siteOrigin: string): string {
  const prefix = locale && locale !== 'en' ? `/${locale}` : '';
  return `${siteOrigin.replace(/\/$/, '')}${prefix}/rsvp/edit?t=${token}`;
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Never expose the token in a payload that goes back over the wire. */
function publicRow(row: PartyRow): Omit<PartyRow, 'token'> {
  const { token: _token, ...rest } = row;
  return rest;
}

function phaseOf(deps: Deps): RsvpPhase {
  const config = deps.config();
  return rsvpPhase(deps.now(), config.softDeadline, config.hardLock);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export function handleStatus(deps: Deps): ApiResponse {
  const config = deps.config();
  const phase = phaseOf(deps);
  return {
    ok: true,
    phase,
    open: phase !== 'locked',
    softDeadline: config.softDeadline,
    hardLock: config.hardLock,
    eventAt: config.eventAt,
    // Exposed so the smoke test can catch the one misconfiguration that is
    // invisible until a guest complains: siteOrigin left at its localhost
    // default, which sends every confirmation email to a link that only works
    // on the developer's own machine.
    siteOrigin: config.siteOrigin,
  };
}

export function handleGet(deps: Deps, token: string): ApiResponse {
  const row = token ? deps.sheet.findByToken(token) : null;
  // Identical response for a missing and a malformed token, so the endpoint
  // gives nothing away to someone guessing.
  if (!row) return { ok: false, error: 'NOT_FOUND' };

  const phase = phaseOf(deps);
  return {
    ok: true,
    phase,
    readOnly: phase === 'locked',
    rsvp: publicRow(row),
  };
}

export function handleCreate(deps: Deps, body: Record<string, unknown>): ApiResponse {
  const config = deps.config();
  const phase = phaseOf(deps);

  // The authoritative deadline check. The form hides itself after the lock, but
  // that is cosmetic — this is what actually stops a late write.
  if (phase === 'locked') return { ok: false, error: 'CLOSED', phase };

  // A hidden field no person ever sees. Answer as though it worked, so a bot
  // gets no signal that it was caught.
  if (body.hp) return { ok: true, token: 'ok', editUrl: config.siteOrigin };

  const locale = typeof body.locale === 'string' ? body.locale : 'en';
  const result = validateRsvp(body.payload, { hotelNights: config.hotelNights });
  if (!result.ok || !result.value) {
    return { ok: false, error: 'VALIDATION', fields: result.errors };
  }

  const payload = result.value;
  const email = normalizeEmail(payload.email);

  return deps.lock(() => {
    // Two people from the same party both replying is common. Rather than
    // creating a duplicate, hand back the link to the one that exists.
    const existing = email ? deps.sheet.findByEmail(email) : null;
    if (existing) {
      sendConfirmation(deps, existing, config);
      return {
        ok: true,
        duplicate: true,
        token: existing.token,
        partyCode: existing.partyCode,
        editUrl: editUrl(existing.token, existing.locale, config.siteOrigin),
      };
    }

    const token = deps.uuid();
    const timestamp = deps.now().toISOString();
    const row: PartyRow = {
      token,
      partyCode: partyCode(token),
      email,
      locale,
      payload: { ...payload, inviteCode: normalizeInviteCode(payload.inviteCode) },
      late: phase === 'late',
      version: 1,
      submittedAt: timestamp,
      updatedAt: timestamp,
      emailBounced: false,
      possibleDuplicate: hasNameClash(deps, payload, token),
    };

    deps.sheet.insert(row);
    deps.sheet.appendSubmission({
      at: timestamp,
      token,
      action: 'create',
      version: 1,
      payload: row.payload,
    });

    sendConfirmation(deps, row, config);

    return {
      ok: true,
      token,
      partyCode: row.partyCode,
      editUrl: editUrl(token, locale, config.siteOrigin),
    };
  });
}

export function handleUpdate(deps: Deps, body: Record<string, unknown>): ApiResponse {
  const config = deps.config();
  const phase = phaseOf(deps);
  if (phase === 'locked') return { ok: false, error: 'CLOSED', phase };

  const token = typeof body.token === 'string' ? body.token : '';
  const existing = token ? deps.sheet.findByToken(token) : null;
  if (!existing) return { ok: false, error: 'NOT_FOUND' };

  const result = validateRsvp(body.payload, { hotelNights: config.hotelNights });
  if (!result.ok || !result.value) {
    return { ok: false, error: 'VALIDATION', fields: result.errors };
  }

  const locale = typeof body.locale === 'string' ? body.locale : existing.locale;

  return deps.lock(() => {
    const timestamp = deps.now().toISOString();
    const updated: PartyRow = {
      ...existing,
      locale,
      email: normalizeEmail(result.value!.email) || existing.email,
      payload: result.value!,
      version: existing.version + 1,
      updatedAt: timestamp,
      possibleDuplicate: hasNameClash(deps, result.value!, existing.token),
    };

    deps.sheet.update(updated);
    // Append-only: no edit ever destroys what was there before. This is what
    // answers "I definitely said vegan" six months later, and it is also why
    // there is no optimistic locking — the losing write is still recoverable
    // from this log rather than lost.
    deps.sheet.appendSubmission({
      at: timestamp,
      token: existing.token,
      action: 'update',
      version: updated.version,
      payload: updated.payload,
    });

    sendConfirmation(deps, updated, config);

    return {
      ok: true,
      token: existing.token,
      partyCode: updated.partyCode,
      editUrl: editUrl(existing.token, locale, config.siteOrigin),
    };
  });
}

export function handleResend(deps: Deps, body: Record<string, unknown>): ApiResponse {
  const config = deps.config();
  const email = normalizeEmail(body.email);
  const row = email ? deps.sheet.findByEmail(email) : null;

  // The response is identical whether or not the address is known, and the mail
  // goes only to the STORED address — never to whatever was typed in.
  if (row) sendConfirmation(deps, row, config);
  return { ok: true };
}

/**
 * Get back into a reply using the party code from the confirmation email.
 *
 * Requires the code AND the email address it was issued to. Six characters is
 * around a billion combinations — comfortably beyond guessing by hand, but a
 * script could walk it in minutes, and behind it sit names, phone numbers,
 * children's ages and allergies. Pairing it with the address the code was sent
 * to closes that off: an attacker would need both, and the address is not
 * something you can enumerate.
 *
 * The failure response is identical in every case, so it cannot be used to
 * discover which addresses have replied.
 */
export function handleFind(deps: Deps, body: Record<string, unknown>): ApiResponse {
  const config = deps.config();
  const email = normalizeEmail(body.email);
  const code = normalizePartyCode(typeof body.partyCode === 'string' ? body.partyCode : '');
  if (!email || !code) return { ok: false, error: 'NOT_FOUND' };

  const row = deps.sheet.findByEmail(email);
  if (!row || row.partyCode !== code) return { ok: false, error: 'NOT_FOUND' };

  return {
    ok: true,
    token: row.token,
    editUrl: editUrl(row.token, row.locale, config.siteOrigin),
  };
}

/** A name in this party that already appears in another. Flagged, never blocked. */
function hasNameClash(deps: Deps, payload: RsvpPayload, ownToken: string): boolean {
  const mine = payload.attendees.map((a) => normalizeName(a.fullName)).filter(Boolean);
  if (mine.length === 0) return false;
  return deps.sheet
    .allNames()
    .some((entry) => entry.token !== ownToken && mine.includes(normalizeName(entry.name)));
}

/**
 * Email is best-effort. A mail failure must never fail the submission — the
 * answer is already safely stored, and losing it because Gmail hiccuped would
 * be far worse than a guest not receiving a receipt.
 */
function sendConfirmation(deps: Deps, row: PartyRow, config: BackendConfig): void {
  if (!row.email) return;
  try {
    const { subject, body } = deps.renderEmail(row, config);
    deps.mailer.send({ to: row.email, subject, body, replyTo: config.replyTo });
  } catch (error) {
    deps.log?.(`email failed for ${row.token}: ${String(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export function dispatchGet(deps: Deps, params: Record<string, string>): ApiResponse {
  switch (params.action) {
    case 'status':
      return handleStatus(deps);
    case 'get':
      return handleGet(deps, params.t ?? params.token ?? '');
    default:
      return { ok: false, error: 'UNKNOWN_ACTION' };
  }
}

export function dispatchPost(deps: Deps, body: Record<string, unknown>): ApiResponse {
  switch (body.action) {
    case 'create':
      return handleCreate(deps, body);
    case 'update':
      return handleUpdate(deps, body);
    case 'resend':
      return handleResend(deps, body);
    case 'find':
      return handleFind(deps, body);
    default:
      return { ok: false, error: 'UNKNOWN_ACTION' };
  }
}
