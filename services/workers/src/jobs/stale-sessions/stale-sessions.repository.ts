import type { Sql } from '../../lib/db';

export interface ClosedSession {
  id: string;
  segmentCount: number;
}

export interface StaleSessionsRepository {
  /**
   * Ends up to `limit` live sessions with no activity since `cutoff` in one statement and returns them.
   * Activity = start of the session plus the end of its last segment (segments carry no wall-clock time).
   * `ended_at` is that moment, never later than now. Only rows still 'live' are touched, so a second run finds nothing.
   */
  closeStaleLive(cutoff: Date, limit: number): Promise<ClosedSession[]>;
}

export function createPostgresStaleSessionsRepository(sql: Sql): StaleSessionsRepository {
  return {
    async closeStaleLive(cutoff, limit) {
      return sql<ClosedSession[]>`
        WITH stale AS (
          SELECT s.id,
            LEAST(
              s.started_at + COALESCE(MAX(g.end_ms), 0) * interval '1 millisecond',
              now()
            ) AS last_activity,
            COUNT(g.id)::int AS segment_count
          FROM sessions s LEFT JOIN segments g ON g.session_id = s.id
          WHERE s.status = 'live'
          GROUP BY s.id, s.started_at
          HAVING s.started_at + COALESCE(MAX(g.end_ms), 0) * interval '1 millisecond' < ${cutoff}
          ORDER BY s.started_at
          LIMIT ${limit}
        )
        UPDATE sessions SET status = 'ended', ended_at = stale.last_activity
        FROM stale
        WHERE sessions.id = stale.id AND sessions.status = 'live'
        RETURNING sessions.id, stale.segment_count AS "segmentCount"`;
    },
  };
}
