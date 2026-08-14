/**
 * Codes.
 *
 * **The PARTY code** is the one that matters. It is generated when a guest
 * replies, shown on the success screen and in their confirmation email, and
 * lets them back into their answer later if they lose that email. The couple
 * also use it on the day for seating and check-in.
 *
 * It is a convenience, never a credential on its own. Six characters is around
 * a billion combinations, which is plenty against idle guessing but nothing
 * against a script — so getting back in needs the code **and** the email
 * address it was issued to. The unguessable thing remains the 122-bit token in
 * the emailed link.
 *
 * **The ENTRY code** is optional and currently switched off
 * (`EVENT.rsvp.inviteCode` is null). If the couple ever print a code on the
 * invitations, setting that value turns the gate back on. When it is on, the
 * page ships only a SHA-256 of it — though a short typeable code can be
 * recovered from that hash by anyone who cares to, so it was only ever a speed
 * bump against drive-by bots, not a lock.
 */

/** Case- and punctuation-insensitive, so "grohnde 27" and "GROHNDE-27" match. */
export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Hex SHA-256 of the normalised code. Works in the browser and in Node. */
export async function hashInviteCode(raw: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeInviteCode(raw));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Alphabet with the characters people misread out of it: no I, O, 0 or 1.
 * These codes get read down the phone and copied off a screen.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Six characters ≈ 1.07 billion combinations, and still readable aloud. */
export const PARTY_CODE_LENGTH = 6;

/**
 * A short, stable reference for one party, derived from their token.
 *
 * Deterministic, so it can be recomputed from the sheet at any time rather than
 * stored and kept in sync.
 *
 * Six characters rather than four because this code now unlocks a guest's own
 * answer. Four was about a million combinations — fine as a seating reference,
 * far too few once it opens a form. Even at six it is never accepted alone: the
 * lookup also requires the email address it was issued to.
 *
 * Collisions at wedding scale are negligible: 100 parties against a billion
 * values is roughly a one-in-two-hundred-thousand chance.
 */
export function partyCode(token: string, prefix = 'MT'): string {
  // FNV-1a over the token, then a second pass with a different offset basis to
  // get the 30 bits six characters need out of a 32-bit hash.
  const fnv = (seed: number) => {
    let hash = seed;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash;
  };

  const low = fnv(2166136261);
  const high = fnv(0x811c9dc5 ^ 0x5f5f5f5f);

  let out = '';
  for (let i = 0; i < PARTY_CODE_LENGTH; i += 1) {
    const source = i < 6 ? (i < 4 ? low : high) : high;
    const shift = (i % 4) * 5;
    out += ALPHABET[(source >>> shift) & 31];
  }
  return `${prefix}-${out}`;
}

/** Accepts "mt4k9p2x", "MT-4K9P2X", "mt 4k9p 2x" — all the same code. */
export function normalizePartyCode(raw: string, prefix = 'MT'): string {
  const bare = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const stripped = bare.startsWith(prefix) ? bare.slice(prefix.length) : bare;
  return stripped ? `${prefix}-${stripped}` : '';
}

/** How many wrong attempts before the form opens anyway. */
export const MAX_CODE_ATTEMPTS = 2;
