import {
  DEFAULT_LANGUAGE,
  type LanguageCode,
  type Phrase,
  type SavePhraseRequest,
} from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

/** Phrase Bank persistence. Every operation is scoped by the authenticated user's id. */
export interface PhrasesRepository {
  list(userId: string, language: LanguageCode): Promise<Phrase[]>;
  save(userId: string, input: SavePhraseRequest): Promise<Phrase>;
  delete(userId: string, id: string): Promise<boolean>;
}

interface PhraseRow {
  id: string;
  phrase: string;
  meaning_vi: string | null;
  in_review: boolean;
}

const toPhrase = (row: PhraseRow): Phrase => ({
  id: row.id,
  phrase: row.phrase,
  meaningVi: row.meaning_vi,
  inReview: row.in_review,
});

export function createPostgresPhrasesRepository(sql: Sql): PhrasesRepository {
  return {
    async list(userId, language) {
      const rows = await sql<PhraseRow[]>`
        SELECT lexical_items.id, lexical_items.lemma AS phrase,
               user_lexicon.meaning_vi, user_lexicon.in_review
        FROM user_lexicon
        JOIN lexical_items ON lexical_items.id = user_lexicon.item_id
        WHERE user_lexicon.user_id = ${userId} AND lexical_items.type = 'phrase'
          AND lexical_items.language = ${language}
        ORDER BY lexical_items.lemma`;
      return rows.map(toPhrase);
    },

    async save(userId, input) {
      const [row] = await sql<PhraseRow[]>`
        WITH lang AS (
          -- A phrase saved from a meeting belongs to that meeting's language.
          SELECT COALESCE(
            (SELECT language FROM sessions
             WHERE id = ${input.sessionId ?? null} AND user_id = ${userId}),
            ${input.language ?? DEFAULT_LANGUAGE}
          ) AS code
        ), item AS (
          INSERT INTO lexical_items (language, lemma, type)
          SELECT lang.code, ${input.phrase}, 'phrase' FROM lang
          ON CONFLICT (language, lemma, type) DO UPDATE SET lemma = EXCLUDED.lemma
          RETURNING id, lemma
        ), owned_context AS (
          SELECT segments.id
          FROM segments
          JOIN sessions ON sessions.id = segments.session_id
          WHERE segments.id = ${input.segmentId ?? null}
            AND sessions.user_id = ${userId}
            AND (${input.sessionId ?? null}::uuid IS NULL OR sessions.id = ${input.sessionId ?? null})
        ), saved AS (
          INSERT INTO user_lexicon (
            user_id, item_id, first_context_segment_id, meaning_vi, in_review
          )
          SELECT ${userId}, item.id, (SELECT id FROM owned_context), ${input.meaningVi ?? null}, true
          FROM item
          ON CONFLICT (user_id, item_id) DO UPDATE SET
            meaning_vi = CASE
              WHEN ${input.meaningVi !== undefined} THEN EXCLUDED.meaning_vi
              ELSE user_lexicon.meaning_vi
            END,
            first_context_segment_id = COALESCE(
              user_lexicon.first_context_segment_id,
              EXCLUDED.first_context_segment_id
            ),
            in_review = true
          RETURNING item_id, meaning_vi, in_review
        )
        SELECT saved.item_id AS id, item.lemma AS phrase, saved.meaning_vi, saved.in_review
        FROM saved JOIN item ON item.id = saved.item_id`;
      return toPhrase(row!);
    },

    async delete(userId, id) {
      const result = await sql`
        DELETE FROM user_lexicon WHERE user_id = ${userId} AND item_id = ${id}`;
      return result.count > 0;
    },
  };
}
