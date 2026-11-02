import type { DebriefContent, LanguageCode } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

export interface DebriefSegment {
  id: string;
  source: 'mic' | 'system';
  textEn: string;
}

export interface DebriefSession {
  id: string;
  language: LanguageCode;
  segments: DebriefSegment[];
}

export interface DebriefRepository {
  findSession(sessionId: string): Promise<DebriefSession | null>;
  save(sessionId: string, content: DebriefContent, promptVersion: string): Promise<number>;
}

export function createPostgresDebriefRepository(sql: Sql): DebriefRepository {
  return {
    async findSession(sessionId) {
      const [session] = await sql<{ id: string; language: LanguageCode }[]>`
        SELECT id, language FROM sessions WHERE id = ${sessionId}`;
      if (!session) return null;

      const segments = await sql<DebriefSegment[]>`
        SELECT id, source, text_en AS "textEn"
        FROM segments
        WHERE session_id = ${sessionId}
        ORDER BY start_ms, id`;
      return { id: session.id, language: session.language, segments };
    },

    async save(sessionId, content, promptVersion) {
      return sql.begin(async (tx) => {
        // Serialize versions for one session without changing the existing schema.
        await tx`SELECT pg_advisory_xact_lock(hashtextextended(${sessionId}, 0))`;
        const [latest] = await tx<{ version: number }[]>`
          SELECT COALESCE(MAX(version), 0)::integer AS version
          FROM debriefs WHERE session_id = ${sessionId}`;
        const version = (latest?.version ?? 0) + 1;

        await tx`
          INSERT INTO debriefs (
            session_id, version, summary, action_items, hard_segment_ids,
            phrase_suggestions, rephrase, comprehension_pct, prompt_version
          ) VALUES (
            ${sessionId}, ${version}, ${tx.json(content.summary)},
            ${tx.json(content.actionItems)}, ${content.hardSegmentIds}::uuid[],
            ${tx.json(content.phraseSuggestions)}, ${tx.json(content.rephrase)},
            ${content.comprehensionPct}, ${promptVersion}
          )`;
        await tx`UPDATE sessions SET status = 'debriefed' WHERE id = ${sessionId}`;
        return version;
      });
    },
  };
}
