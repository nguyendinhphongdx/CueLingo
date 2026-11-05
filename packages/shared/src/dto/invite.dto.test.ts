import { describe, expect, it } from 'vitest';
import {
  CreateInviteRequestSchema,
  CreatedInviteSchema,
  InviteIntentRequestSchema,
  InviteSchema,
  normalizeInviteCode,
} from './invite.dto';

describe('invite contract', () => {
  it('normalises how people type a code', () => {
    expect(normalizeInviteCode('abcd-efgh jkmn')).toBe('ABCDEFGHJKMN');
    expect(normalizeInviteCode('o0il')).toBe('0011');
  });

  it('accepts a 12 character code in any case with separators', () => {
    expect(InviteIntentRequestSchema.parse({ code: 'abcd-efgh-jkmn' }).code).toBe('ABCDEFGHJKMN');
  });

  it('rejects a short code, a long one and extra fields', () => {
    expect(InviteIntentRequestSchema.safeParse({ code: 'ABC' }).success).toBe(false);
    expect(InviteIntentRequestSchema.safeParse({ code: 'A'.repeat(41) }).success).toBe(false);
    expect(InviteIntentRequestSchema.safeParse({ code: 'ABCDEFGHJKMN', x: 1 }).success).toBe(false);
  });

  it('defaults a new invite to one use and thirty days', () => {
    expect(CreateInviteRequestSchema.parse({})).toEqual({
      maxUses: 1,
      expiresInDays: 30,
      note: null,
    });
  });

  it('bounds uses, days and the note', () => {
    expect(CreateInviteRequestSchema.safeParse({ maxUses: 0 }).success).toBe(false);
    expect(CreateInviteRequestSchema.safeParse({ expiresInDays: 400 }).success).toBe(false);
    expect(CreateInviteRequestSchema.safeParse({ note: 'x'.repeat(101) }).success).toBe(false);
  });

  it('keeps the plain code out of the listed invite', () => {
    const listed = InviteSchema.parse({
      id: '3c1c8f6e-8d0a-4f27-9d8e-2b6f7a8f9c10',
      note: null,
      maxUses: 1,
      usedCount: 0,
      expiresAt: '2026-12-01T00:00:00.000Z',
      revokedAt: null,
      createdAt: '2026-11-01T00:00:00.000Z',
      code: 'ABCDEFGHJKMN',
    });
    expect(listed).not.toHaveProperty('code');
    expect(CreatedInviteSchema.parse({ ...listed, code: 'ABCDEFGHJKMN' }).code).toBe(
      'ABCDEFGHJKMN',
    );
  });
});
