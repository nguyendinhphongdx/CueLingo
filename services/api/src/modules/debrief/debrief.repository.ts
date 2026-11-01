import { randomUUID } from 'node:crypto';
import type { Debrief, DebriefFeedbackRequest } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

export interface DebriefRepository {
  findLatest(userId: string, sessionId: string): Promise<Debrief | null>;
  saveFeedback(userId: string, debriefId: string, input: DebriefFeedbackRequest): Promise<boolean>;
}

interface DebriefRow {
  id: string;
  session_id: string;
  version: number;
  summary: Debrief['summary'];
  action_items: Debrief['actionItems'];
  hard_segment_ids: string[];
  phrase_suggestions: Debrief['phraseSuggestions'];
  rephrase: Debrief['rephrase'];
  comprehension_pct: number | null;
  created_at: Date;
}

const toDebrief = (row: DebriefRow): Debrief => ({
  id: row.id,
  sessionId: row.session_id,
  version: row.version,
  summary: row.summary,
  actionItems: row.action_items,
  hardSegmentIds: row.hard_segment_ids,
  phraseSuggestions: row.phrase_suggestions,
  rephrase: row.rephrase,
  comprehensionPct: row.comprehension_pct,
  createdAt: row.created_at.toISOString(),
});

export function createPostgresDebriefRepository(sql: Sql): DebriefRepository {
  return {
    async findLatest(userId, sessionId) {
      const [row] = await sql<DebriefRow[]>`
        SELECT debriefs.id, debriefs.session_id, debriefs.version, debriefs.summary,
          debriefs.action_items, debriefs.hard_segment_ids, debriefs.phrase_suggestions,
          debriefs.rephrase, debriefs.comprehension_pct, debriefs.created_at
        FROM debriefs JOIN sessions ON sessions.id = debriefs.session_id
        WHERE sessions.user_id = ${userId} AND sessions.id = ${sessionId}
        ORDER BY debriefs.version DESC LIMIT 1`;
      return row ? toDebrief(row) : null;
    },
    async saveFeedback(userId, debriefId, input) {
      const rows = await sql<{ id: string }[]>`
        INSERT INTO events (id, user_id, session_id, type, payload, at)
        SELECT ${randomUUID()}, ${userId}, debriefs.session_id, 'debrief_feedback',
          ${sql.json(input)}, now()
        FROM debriefs JOIN sessions ON sessions.id = debriefs.session_id
        WHERE debriefs.id = ${debriefId} AND sessions.user_id = ${userId}
        RETURNING id`;
      return rows.length > 0;
    },
  };
}
