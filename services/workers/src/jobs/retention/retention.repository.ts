import type { Sql } from '../../lib/db';

export interface ExpiredAudio {
  segmentId: string;
  audioKey: string;
}

export interface RetentionRepository {
  /** Segments whose meeting started before `cutoff` and still point at saved audio. */
  findExpiredAudio(cutoff: Date, limit: number): Promise<ExpiredAudio[]>;
  clearAudioKeys(segmentIds: string[]): Promise<void>;
  /** Permanently removes a bounded batch of soft-deleted sessions older than `cutoff`. */
  deleteExpiredSessions(cutoff: Date, limit: number): Promise<number>;
}

export function createPostgresRetentionRepository(sql: Sql): RetentionRepository {
  return {
    async findExpiredAudio(cutoff, limit) {
      return sql<ExpiredAudio[]>`
        SELECT s.id AS "segmentId", s.audio_key AS "audioKey"
        FROM segments s JOIN sessions m ON m.id = s.session_id
        WHERE s.audio_key IS NOT NULL AND m.started_at < ${cutoff}
        ORDER BY m.started_at
        LIMIT ${limit}`;
    },
    async clearAudioKeys(segmentIds) {
      if (segmentIds.length === 0) return;
      await sql`UPDATE segments SET audio_key = NULL WHERE id IN ${sql(segmentIds)}`;
    },
    async deleteExpiredSessions(cutoff, limit) {
      const deleted = await sql<{ id: string }[]>`
        DELETE FROM sessions
        WHERE id IN (
          SELECT id FROM sessions
          WHERE status = 'deleted' AND ended_at < ${cutoff}
          ORDER BY ended_at
          LIMIT ${limit}
        )
        RETURNING id`;
      return deleted.length;
    },
  };
}
