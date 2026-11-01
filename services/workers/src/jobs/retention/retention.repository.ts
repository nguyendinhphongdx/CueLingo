import type { Sql } from '../../lib/db';

export interface ExpiredAudio {
  segmentId: string;
  audioKey: string;
}

export interface RetentionRepository {
  /** Segments whose meeting started before `cutoff` and still point at saved audio. */
  findExpiredAudio(cutoff: Date, limit: number): Promise<ExpiredAudio[]>;
  clearAudioKeys(segmentIds: string[]): Promise<void>;
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
  };
}
