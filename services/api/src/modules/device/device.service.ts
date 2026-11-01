import { createHash, randomBytes } from 'node:crypto';
import { DEVICE_TOKEN_PREFIX, ErrorCode } from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { DeviceRepository } from './device.repository';

export type DeviceService = ReturnType<typeof createDeviceService>;

export const CODE_TTL_SECONDS = 300;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const random = (bytes: number) => randomBytes(bytes).toString('base64url');

export function createDeviceService(repo: DeviceRepository, clock: () => Date = () => new Date()) {
  return {
    /** A one-time code for the signed-in web user to hand to the desktop app. */
    async issueCode(userId: string) {
      const code = random(32);
      const expiresAt = new Date(clock().getTime() + CODE_TTL_SECONDS * 1000);
      await repo.createCode(userId, sha256(code), expiresAt);
      return { code, expiresInSeconds: CODE_TTL_SECONDS };
    },

    /** Trades a valid code for a device token. A code works once and only for five minutes. */
    async exchange(code: string, label: string | undefined) {
      const userId = await repo.consumeCode(sha256(code), clock());
      if (!userId) throw new AppError(ErrorCode.Unauthorized, 'Invalid or expired sign-in code');
      const token = `${DEVICE_TOKEN_PREFIX}${random(48)}`;
      await repo.createToken(userId, sha256(token), label ?? null);
      return { token };
    },

    /** The user behind a device token, or null. Used by the auth hook and the WebSocket hello. */
    async verifyToken(token: string): Promise<string | null> {
      if (!token.startsWith(DEVICE_TOKEN_PREFIX)) return null;
      return repo.findUserByTokenHash(sha256(token), clock());
    },

    list: (userId: string) => repo.listTokens(userId),

    async revoke(userId: string, id: string) {
      if (!(await repo.revokeToken(userId, id))) {
        throw new AppError(ErrorCode.NotFound, 'Device not found');
      }
    },

    /** Sign out of this device: revokes the token used for the request. */
    async revokeSelf(token: string) {
      await repo.revokeByHash(sha256(token));
    },
  };
}
