import { createHash, randomBytes } from 'node:crypto';
import {
  ErrorCode,
  INVITE_CODE_LENGTH,
  InviteCodeSchema,
  type CreateInviteRequest,
  type CreatedInvite,
  type Invite,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { InvitesRepository } from './invites.repository';

export type InvitesService = ReturnType<typeof createInvitesService>;

/** Crockford base32: no I, L, O or U, so a code read out loud or typed from a screenshot survives. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DAY_MS = 24 * 60 * 60 * 1000;

export const hashInviteCode = (code: string): string =>
  createHash('sha256').update(code).digest('hex');

/** 12 symbols of 5 bits: 60 bits of randomness, which guessing cannot cover. */
export function generateInviteCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  return Array.from(bytes, (byte) => ALPHABET[byte % 32]).join('');
}

/** The one message every refusal uses, so a rejected code does not say why. */
export const INVITE_REFUSED = 'Mã mời không dùng được';

export function createInvitesService(
  repo: InvitesRepository,
  isAdmin: (userId: string) => Promise<boolean>,
  now: () => Date = () => new Date(),
) {
  async function assertAdmin(userId: string): Promise<void> {
    if (!(await isAdmin(userId))) throw new AppError(ErrorCode.Forbidden, 'Admin access required');
  }

  return {
    /** The normalised code when it can still be used, else null. Never says which rule it broke. */
    async check(raw: unknown): Promise<string | null> {
      const parsed = InviteCodeSchema.safeParse(raw);
      if (!parsed.success) return null;
      return (await repo.isUsable(hashInviteCode(parsed.data), now())) ? parsed.data : null;
    },

    async create(userId: string, input: CreateInviteRequest): Promise<CreatedInvite> {
      await assertAdmin(userId);
      const code = generateInviteCode();
      const invite = await repo.create({
        codeHash: hashInviteCode(code),
        maxUses: input.maxUses,
        note: input.note,
        expiresAt: new Date(now().getTime() + input.expiresInDays * DAY_MS),
        createdBy: userId,
      });
      return { ...invite, code };
    },

    async list(userId: string): Promise<Invite[]> {
      await assertAdmin(userId);
      return repo.list();
    },

    async revoke(userId: string, id: string): Promise<void> {
      await assertAdmin(userId);
      if (!(await repo.revoke(id))) throw new AppError(ErrorCode.NotFound, 'Invite not found');
    },

    /**
     * Used by the sign-up gate: spends one use of the code that came with the request.
     * Returns the invite id, or null when there is no usable code.
     */
    async redeem(raw: unknown): Promise<string | null> {
      const parsed = InviteCodeSchema.safeParse(raw);
      if (!parsed.success) return null;
      return repo.consume(hashInviteCode(parsed.data), now());
    },

    recordRedemption: (inviteId: string, userId: string) => repo.recordRedemption(inviteId, userId),
  };
}
