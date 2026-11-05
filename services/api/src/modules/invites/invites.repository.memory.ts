import { randomUUID } from 'node:crypto';
import type { Invite } from '@cuelingo/shared';
import type { InvitesRepository } from './invites.repository';

interface Row extends Invite {
  codeHash: string;
}

/** In-memory implementation with the same contract, for tests and local demos. */
export function createInMemoryInvitesRepository(): InvitesRepository & {
  redemptions: Array<{ inviteId: string; userId: string }>;
} {
  const rows: Row[] = [];
  const redemptions: Array<{ inviteId: string; userId: string }> = [];
  const strip = ({ codeHash: _codeHash, ...invite }: Row): Invite => invite;
  const usable = (row: Row | undefined, now: Date): row is Row =>
    Boolean(row && !row.revokedAt && new Date(row.expiresAt) > now && row.usedCount < row.maxUses);

  return {
    redemptions,
    async create(input) {
      const row: Row = {
        id: randomUUID(),
        codeHash: input.codeHash,
        note: input.note,
        maxUses: input.maxUses,
        usedCount: 0,
        expiresAt: input.expiresAt.toISOString(),
        revokedAt: null,
        createdAt: new Date().toISOString(),
      };
      rows.push(row);
      return strip(row);
    },
    async list() {
      return [...rows].reverse().map(strip);
    },
    async revoke(id) {
      const row = rows.find((r) => r.id === id);
      if (!row || row.revokedAt) return false;
      row.revokedAt = new Date().toISOString();
      return true;
    },
    async isUsable(codeHash, now) {
      return usable(
        rows.find((r) => r.codeHash === codeHash),
        now,
      );
    },
    async consume(codeHash, now) {
      const row = rows.find((r) => r.codeHash === codeHash);
      if (!usable(row, now)) return null;
      row.usedCount += 1;
      return row.id;
    },
    async recordRedemption(inviteId, userId) {
      if (!redemptions.some((r) => r.userId === userId)) redemptions.push({ inviteId, userId });
    },
  };
}
