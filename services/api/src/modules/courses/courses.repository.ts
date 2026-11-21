import type { CourseSource } from '@cuelingo/learner-model';
import type { LanguageCode } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

/** One meeting with a debrief: the latest debrief version, reduced to what a course is made from. */
export interface CourseSourceRow {
  sessionId: string;
  language: LanguageCode;
  startedAt: Date;
  /** When the debrief was made; review logs before this do not count towards the course. */
  debriefAt: Date;
  headline: string;
  source: CourseSource;
}

export interface CourseLog {
  itemId: string;
  at: Date;
  rating: number;
}

export interface CourseTerm {
  term: string;
  translation: string | null;
}

export interface ListSourcesOptions {
  language?: LanguageCode;
  /** Only these meetings (ids from the client are still checked against the user). */
  sessionIds?: string[];
  limit: number;
}

/** Read model for courses. Every method is scoped by the authenticated user's id; nothing is stored. */
export interface CoursesRepository {
  /** Newest meeting first; deleted meetings and meetings without a debrief are left out. */
  listSources(userId: string, options: ListSourcesOptions): Promise<CourseSourceRow[]>;
  /** Review logs of these items at or after `since`. */
  listLogs(userId: string, itemIds: string[], since: Date): Promise<CourseLog[]>;
  listTerms(userId: string, language: LanguageCode, limit: number): Promise<CourseTerm[]>;
}

interface SourceRow {
  id: string;
  language: LanguageCode;
  started_at: Date;
  debrief_at: Date;
  summary: { headlineVi: string };
  hard_segment_ids: string[];
  phrase_suggestions: CourseSource['phraseSuggestions'];
  rephrase: CourseSource['rephrase'];
}

export function createPostgresCoursesRepository(sql: Sql): CoursesRepository {
  return {
    async listSources(userId, options) {
      const rows = await sql<SourceRow[]>`
        SELECT sessions.id, sessions.language, sessions.started_at, latest.created_at AS debrief_at,
               latest.summary, latest.hard_segment_ids, latest.phrase_suggestions, latest.rephrase
        FROM sessions
        JOIN LATERAL (
          SELECT created_at, summary, hard_segment_ids, phrase_suggestions, rephrase
          FROM debriefs WHERE debriefs.session_id = sessions.id
          ORDER BY version DESC LIMIT 1
        ) latest ON true
        WHERE sessions.user_id = ${userId} AND sessions.status <> 'deleted'
          AND (${options.language ?? null}::text IS NULL OR sessions.language = ${options.language ?? null})
          AND (${options.sessionIds ?? null}::uuid[] IS NULL OR sessions.id = ANY(${options.sessionIds ?? null}::uuid[]))
        ORDER BY sessions.started_at DESC
        LIMIT ${options.limit}`;
      if (rows.length === 0) return [];
      const sessionIds = rows.map((row) => row.id);
      const hardIds = rows.flatMap((row) => row.hard_segment_ids);
      const segments = await sql<{ id: string; text_en: string }[]>`
        SELECT id, text_en FROM segments
        WHERE session_id = ANY(${sessionIds}::uuid[]) AND id = ANY(${hardIds}::uuid[])`;
      const textOf = new Map(segments.map((segment) => [segment.id, segment.text_en]));
      return rows.map((row) => ({
        sessionId: row.id,
        language: row.language,
        startedAt: row.started_at,
        debriefAt: row.debrief_at,
        headline: row.summary.headlineVi,
        source: {
          hardSegments: row.hard_segment_ids.flatMap((id) => {
            const text = textOf.get(id);
            return text === undefined ? [] : [{ id, text }];
          }),
          phraseSuggestions: row.phrase_suggestions,
          rephrase: row.rephrase,
        },
      }));
    },

    async listLogs(userId, itemIds, since) {
      if (itemIds.length === 0) return [];
      const rows = await sql<{ item_id: string; at: Date; rating: number }[]>`
        SELECT item_id, at, rating FROM review_logs
        WHERE user_id = ${userId} AND item_id = ANY(${itemIds}::uuid[]) AND at >= ${since}`;
      return rows.map((row) => ({ itemId: row.item_id, at: row.at, rating: row.rating }));
    },

    async listTerms(userId, language, limit) {
      const rows = await sql<{ term: string; translation: string | null }[]>`
        SELECT term, translation FROM glossary_terms
        WHERE user_id = ${userId} AND language = ${language}
        ORDER BY created_at DESC LIMIT ${limit}`;
      return rows;
    },
  };
}
