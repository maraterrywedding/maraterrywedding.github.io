import { describe, expect, it } from 'vitest';
import {
  MAX_CODE_ATTEMPTS,
  PARTY_CODE_LENGTH,
  hashInviteCode,
  normalizeInviteCode,
  normalizePartyCode,
  partyCode,
} from '@/lib/rsvp/invite';
import { EVENT } from '@/data/event';

describe('normalizeInviteCode', () => {
  it('ignores case, spaces and punctuation', () => {
    const expected = 'GROHNDE27';
    for (const typed of ['GROHNDE27', 'grohnde27', 'Grohnde 27', 'grohnde-27', ' GROHNDE_27 ']) {
      expect(normalizeInviteCode(typed), typed).toBe(expected);
    }
  });

  it('strips everything that is not a letter or digit', () => {
    expect(normalizeInviteCode('a!b@c#1')).toBe('ABC1');
    expect(normalizeInviteCode('')).toBe('');
  });
});

describe('hashInviteCode', () => {
  it('is stable and matches regardless of how the guest typed it', async () => {
    const a = await hashInviteCode('GROHNDE27');
    const b = await hashInviteCode('grohnde 27');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs for a different code', async () => {
    expect(await hashInviteCode('GROHNDE27')).not.toBe(await hashInviteCode('GROHNDE28'));
  });
});

describe('partyCode', () => {
  it('has a readable shape', () => {
    expect(partyCode('3f0b7a2c-9d41-4e88-9b0e-6c2f1a5d7e33')).toMatch(/^MT-[A-Z2-9]{6}$/);
  });

  it('is deterministic — the same token always gives the same code', () => {
    const token = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(partyCode(token)).toBe(partyCode(token));
  });

  it('avoids characters people misread aloud', () => {
    // No I, O, 0 or 1 — these get read down the phone and copied off screens.
    for (let i = 0; i < 500; i += 1) {
      const code = partyCode(`token-${i}-${i * 7919}`).slice(3);
      expect(code, `token-${i}`).not.toMatch(/[IO01]/);
    }
  });

  it('spreads similar tokens apart', () => {
    // 2,000 near-identical inputs, no collisions. At six characters the space
    // is about a billion, so this should be exact.
    const codes = new Set(Array.from({ length: 2000 }, (_, i) => partyCode(`token-${i}`)));
    expect(codes.size).toBe(2000);
  });

  it('is long enough to be worth pairing with an email, and no longer', () => {
    // It unlocks a guest's own answer, so four characters (a million values)
    // would be walkable by a script. Six is a billion — but it is still never
    // accepted without the address it was issued to.
    expect(PARTY_CODE_LENGTH).toBe(6);
  });

  it('accepts a different prefix', () => {
    expect(partyCode('abc', 'WD')).toMatch(/^WD-/);
  });
});

describe('normalizePartyCode', () => {
  it('accepts however the guest types it', () => {
    for (const typed of ['MT-4K9P2X', 'mt4k9p2x', 'mt 4k9p 2x', '4K9P2X', 'mt-4k9p-2x']) {
      expect(normalizePartyCode(typed), typed).toBe('MT-4K9P2X');
    }
  });

  it('returns empty for nothing usable', () => {
    expect(normalizePartyCode('')).toBe('');
    expect(normalizePartyCode('---')).toBe('');
  });
});

describe('the optional entry code', () => {
  it('is currently off — nothing is printed on the invitations', () => {
    expect(EVENT.rsvp.inviteCode).toBeNull();
  });

  it('would still let a guest through rather than blocking them, if enabled', () => {
    expect(MAX_CODE_ATTEMPTS).toBeGreaterThan(0);
    expect(MAX_CODE_ATTEMPTS).toBeLessThanOrEqual(3);
  });

  it('normalizes consistently, ready for the day it is switched on', () => {
    expect(normalizeInviteCode('grohnde 27')).toBe('GROHNDE27');
  });
});
