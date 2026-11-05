import type { CreateInviteRequest, Invite } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

export interface NewInvite extends Pick<CreateInviteRequest, 'maxUses' | 'note'> {
  codeHash: string;
  expiresAt: Date;
  createdBy: string | null;
}

/** Data access for invite codes. Codes are only ever handled as their SHA-256 hash. */
export interface InvitesRepository {
  create(input: NewInvite): Promise<Invite>;
  list(): Promise<Invite[]>;
  revoke(id: string): Promise<boolean>;
  /** True when the code exists, is unrevoked, unexpired and has a use left. Does not use it up. */
  isUsable(codeHash: string, now: Date): Promise<boolean>;
  /** Uses one up in a single statement, so two people cannot take the last use. Returns the invite id, or null. */
  consume(codeHash: string, now: Date): Promise<string | null>;
  recordRedemption(inviteId: string, userId: string): Promise<void>;
}

interface InviteRow {
  id: string;
  note: string | null;
  max_uses: number;
  used_count: number;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

const toInvite = (row: InviteRow): Invite => ({
  id: row.id,
  note: row.note,
  maxUses: row.max_uses,
  usedCount: row.used_count,
  expiresAt: row.expires_at.toISOString(),
  revokedAt: row.revoked_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
});

export function createPostgresInvitesRepository(sql: Sql): InvitesRepository {
  return {
    async create(input) {
      const [row] = await sql<InviteRow[]>`
        INSERT INTO invites (code_hash, max_uses, expires_at, note, created_by)
        VALUES (${input.codeHash}, ${input.maxUses}, ${input.expiresAt}, ${input.note}, ${input.createdBy})
        RETURNING id, note, max_uses, used_count, expires_at, revoked_at, created_at`;
      return toInvite(row!);
    },
    async list() {
      const rows = await sql<InviteRow[]>`
        SELECT id, note, max_uses, used_count, expires_at, revoked_at, created_at
        FROM invites ORDER BY created_at DESC LIMIT 200`;
      return rows.map(toInvite);
    },
    async revoke(id) {
      const result =
        await sql`UPDATE invites SET revoked_at = now() WHERE id = ${id} AND revoked_at IS NULL`;
      return result.count > 0;
    },
    async isUsable(codeHash, now) {
      const rows = await sql`
        SELECT 1 FROM invites
        WHERE code_hash = ${codeHash} AND revoked_at IS NULL AND expires_at > ${now} AND used_count < max_uses`;
      return rows.length > 0;
    },
    async consume(codeHash, now) {
      const [row] = await sql<{ id: string }[]>`
        UPDATE invites SET used_count = used_count + 1
        WHERE code_hash = ${codeHash} AND revoked_at IS NULL AND expires_at > ${now} AND used_count < max_uses
        RETURNING id`;
      return row?.id ?? null;
    },
    async recordRedemption(inviteId, userId) {
      await sql`
        INSERT INTO invite_redemptions (invite_id, user_id) VALUES (${inviteId}, ${userId})
        ON CONFLICT (user_id) DO NOTHING`;
    },
  };
}
