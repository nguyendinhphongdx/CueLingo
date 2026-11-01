import type { Debrief, Export, ExportSession } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

export interface PrivacyRepository {
  deleteMyData(userId: string): Promise<void>;
  exportMyData(userId: string, exportedAt: Date): Promise<Export>;
}

interface SessionRow {
  id: string;
  title: string | null;
  started_at: Date;
  ended_at: Date | null;
  status: ExportSession['status'];
  assist_level: number;
}

interface SegmentRow {
  id: string;
  session_id: string;
  source: ExportSession['segments'][number]['source'];
  start_ms: number;
  end_ms: number;
  text_en: string;
  text_vi: string | null;
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

export function createPostgresPrivacyRepository(sql: Sql): PrivacyRepository {
  return {
    async deleteMyData(userId) {
      await sql.begin(async (tx) => {
        await tx`DELETE FROM review_logs WHERE user_id = ${userId}`;
        await tx`DELETE FROM user_lexicon WHERE user_id = ${userId}`;
        await tx`DELETE FROM glossary_terms WHERE user_id = ${userId}`;
        await tx`DELETE FROM events WHERE user_id = ${userId}`;
        await tx`DELETE FROM sessions WHERE user_id = ${userId}`;
      });
    },

    async exportMyData(userId, exportedAt) {
      return sql.begin(async (tx) => {
        const sessionRows = await tx<SessionRow[]>`
          SELECT id, title, started_at, ended_at, status, assist_level
          FROM sessions
          WHERE user_id = ${userId} AND status <> 'deleted'
          ORDER BY started_at DESC`;
        const segmentRows = await tx<SegmentRow[]>`
          SELECT segments.id, segments.session_id, segments.source, segments.start_ms,
            segments.end_ms, segments.text_en, segments.text_vi
          FROM segments
          JOIN sessions ON sessions.id = segments.session_id
          WHERE sessions.user_id = ${userId} AND sessions.status <> 'deleted'
          ORDER BY segments.session_id, segments.start_ms`;
        const debriefRows = await tx<DebriefRow[]>`
          SELECT DISTINCT ON (debriefs.session_id)
            debriefs.id, debriefs.session_id, debriefs.version, debriefs.summary,
            debriefs.action_items, debriefs.hard_segment_ids, debriefs.phrase_suggestions,
            debriefs.rephrase, debriefs.comprehension_pct, debriefs.created_at
          FROM debriefs
          JOIN sessions ON sessions.id = debriefs.session_id
          WHERE sessions.user_id = ${userId} AND sessions.status <> 'deleted'
          ORDER BY debriefs.session_id, debriefs.version DESC`;
        const phraseRows = await tx<
          Array<{ id: string; phrase: string; meaning_vi: string | null; in_review: boolean }>
        >`
          SELECT lexical_items.id, lexical_items.lemma AS phrase,
            user_lexicon.meaning_vi, user_lexicon.in_review
          FROM user_lexicon
          JOIN lexical_items ON lexical_items.id = user_lexicon.item_id
          WHERE user_lexicon.user_id = ${userId} AND lexical_items.type = 'phrase'
          ORDER BY lexical_items.lemma`;
        const glossaryRows = await tx<
          Array<{
            id: string;
            term: string;
            translation: string | null;
            note: string | null;
            created_at: Date;
          }>
        >`
          SELECT id, term, translation, note, created_at
          FROM glossary_terms
          WHERE user_id = ${userId}
          ORDER BY lower(term)`;

        const segmentsBySession = new Map<string, ExportSession['segments']>();
        for (const row of segmentRows) {
          const segments = segmentsBySession.get(row.session_id) ?? [];
          segments.push({
            id: row.id,
            source: row.source,
            startMs: row.start_ms,
            endMs: row.end_ms,
            textEn: row.text_en,
            textVi: row.text_vi,
          });
          segmentsBySession.set(row.session_id, segments);
        }
        const debriefs = new Map(
          debriefRows.map((row) => [
            row.session_id,
            {
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
            },
          ]),
        );

        return {
          exportedAt: exportedAt.toISOString(),
          sessions: sessionRows.map((row) => ({
            id: row.id,
            title: row.title,
            startedAt: row.started_at.toISOString(),
            endedAt: row.ended_at?.toISOString() ?? null,
            status: row.status,
            assistLevel: row.assist_level,
            segments: segmentsBySession.get(row.id) ?? [],
            debrief: debriefs.get(row.id) ?? null,
          })),
          phrases: phraseRows.map((row) => ({
            id: row.id,
            phrase: row.phrase,
            meaningVi: row.meaning_vi,
            inReview: row.in_review,
          })),
          glossaryTerms: glossaryRows.map((row) => ({
            id: row.id,
            term: row.term,
            translation: row.translation,
            note: row.note,
            createdAt: row.created_at.toISOString(),
          })),
        };
      });
    },
  };
}
