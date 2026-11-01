import type { DeviceToken } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

/** Persistence for desktop sign-in. Codes and tokens are looked up by their SHA-256 hash only. */
export interface DeviceRepository {
  createCode(userId: string, codeHash: string, expiresAt: Date): Promise<void>;
  /** Marks the code used and returns its user, or null when unknown, expired or already used. */
  consumeCode(codeHash: string, now: Date): Promise<string | null>;
  createToken(userId: string, tokenHash: string, label: string | null): Promise<void>;
  /** The user behind a live token, or null when unknown or revoked. */
  findUserByTokenHash(tokenHash: string, now: Date): Promise<string | null>;
  listTokens(userId: string): Promise<DeviceToken[]>;
  revokeToken(userId: string, id: string): Promise<boolean>;
  revokeByHash(tokenHash: string): Promise<boolean>;
}

interface TokenRow {
  id: string;
  label: string | null;
  created_at: Date;
  last_used_at: Date | null;
}

export function createPostgresDeviceRepository(sql: Sql): DeviceRepository {
  return {
    async createCode(userId, codeHash, expiresAt) {
      await sql`
        INSERT INTO device_codes (code_hash, user_id, expires_at)
        VALUES (${codeHash}, ${userId}, ${expiresAt})`;
    },

    async consumeCode(codeHash, now) {
      const [row] = await sql<{ user_id: string }[]>`
        UPDATE device_codes SET used_at = ${now}
        WHERE code_hash = ${codeHash} AND used_at IS NULL AND expires_at > ${now}
        RETURNING user_id`;
      return row?.user_id ?? null;
    },

    async createToken(userId, tokenHash, label) {
      await sql`
        INSERT INTO device_tokens (user_id, token_hash, label)
        VALUES (${userId}, ${tokenHash}, ${label})`;
    },

    async findUserByTokenHash(tokenHash, now) {
      // Touch last_used_at at most once a minute so reads stay cheap.
      const [row] = await sql<{ user_id: string }[]>`
        UPDATE device_tokens
        SET last_used_at = CASE
          WHEN last_used_at IS NULL OR last_used_at < ${new Date(now.getTime() - 60_000)} THEN ${now}
          ELSE last_used_at END
        WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
        RETURNING user_id`;
      return row?.user_id ?? null;
    },

    async listTokens(userId) {
      const rows = await sql<TokenRow[]>`
        SELECT id, label, created_at, last_used_at FROM device_tokens
        WHERE user_id = ${userId} AND revoked_at IS NULL ORDER BY created_at DESC`;
      return rows.map((row) => ({
        id: row.id,
        label: row.label,
        createdAt: row.created_at.toISOString(),
        lastUsedAt: row.last_used_at?.toISOString() ?? null,
      }));
    },

    async revokeToken(userId, id) {
      const result = await sql`
        UPDATE device_tokens SET revoked_at = now()
        WHERE id = ${id} AND user_id = ${userId} AND revoked_at IS NULL`;
      return result.count > 0;
    },

    async revokeByHash(tokenHash) {
      const result = await sql`
        UPDATE device_tokens SET revoked_at = now()
        WHERE token_hash = ${tokenHash} AND revoked_at IS NULL`;
      return result.count > 0;
    },
  };
}

/** In-memory implementation for tests and local demos. */
export function createInMemoryDeviceRepository(): DeviceRepository {
  const codes = new Map<string, { userId: string; expiresAt: Date; used: boolean }>();
  const tokens: Array<{
    id: string;
    userId: string;
    hash: string;
    label: string | null;
    createdAt: Date;
    lastUsedAt: Date | null;
    revoked: boolean;
  }> = [];
  let counter = 0;

  return {
    async createCode(userId, codeHash, expiresAt) {
      codes.set(codeHash, { userId, expiresAt, used: false });
    },
    async consumeCode(codeHash, now) {
      const code = codes.get(codeHash);
      if (!code || code.used || code.expiresAt <= now) return null;
      code.used = true;
      return code.userId;
    },
    async createToken(userId, tokenHash, label) {
      counter += 1;
      tokens.push({
        id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
        userId,
        hash: tokenHash,
        label,
        createdAt: new Date(),
        lastUsedAt: null,
        revoked: false,
      });
    },
    async findUserByTokenHash(tokenHash, now) {
      const token = tokens.find((candidate) => candidate.hash === tokenHash && !candidate.revoked);
      if (!token) return null;
      token.lastUsedAt = now;
      return token.userId;
    },
    async listTokens(userId) {
      return tokens
        .filter((token) => token.userId === userId && !token.revoked)
        .map((token) => ({
          id: token.id,
          label: token.label,
          createdAt: token.createdAt.toISOString(),
          lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
        }));
    },
    async revokeToken(userId, id) {
      const token = tokens.find((c) => c.id === id && c.userId === userId && !c.revoked);
      if (!token) return false;
      token.revoked = true;
      return true;
    },
    async revokeByHash(tokenHash) {
      const token = tokens.find((c) => c.hash === tokenHash && !c.revoked);
      if (!token) return false;
      token.revoked = true;
      return true;
    },
  };
}
