import type { FsrsState } from '@cuelingo/learner-model';
import { DEFAULT_LANGUAGE, type ExerciseType, type LanguageCode } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

/** One Phrase Bank row with the data a review card needs. */
export interface StudyItem {
  itemId: string;
  phrase: string;
  meaningVi: string | null;
  contextEn: string | null;
  inReview: boolean;
  fsrs: FsrsState | null;
}

export interface StudyAnswerLog {
  exercise: ExerciseType;
  rating: number;
  responseMs?: number;
  at: Date;
}

/** Raw facts for the progress page; the service turns them into the shared `Progress`. */
export interface ProgressFacts {
  reviewTimes: Date[];
  meetingStarts: Date[];
  lookupTimes: Date[];
  avgComprehensionPct: number | null;
}

/** Review persistence. Every operation is scoped by the authenticated user's id. */
export interface StudyRepository {
  /** Items of one language, or of every language when `language` is left out (to find an answered item). */
  listItems(userId: string, language?: LanguageCode): Promise<StudyItem[]>;
  /** Stores the new FSRS state and one review log in a transaction; false when the item is not the user's. */
  saveAnswer(
    userId: string,
    itemId: string,
    fsrs: FsrsState,
    log: StudyAnswerLog,
  ): Promise<boolean>;
  progressFacts(userId: string, language: LanguageCode, since: Date): Promise<ProgressFacts>;
}

interface ItemRow {
  item_id: string;
  phrase: string;
  meaning_vi: string | null;
  context_en: string | null;
  in_review: boolean;
  receptive_fsrs: FsrsState | null;
}

export function createPostgresStudyRepository(sql: Sql): StudyRepository {
  return {
    async listItems(userId, language) {
      const rows = await sql<ItemRow[]>`
        SELECT user_lexicon.item_id, lexical_items.lemma AS phrase, user_lexicon.meaning_vi,
               COALESCE(segments.text_en, user_lexicon.context_text) AS context_en, user_lexicon.in_review, user_lexicon.receptive_fsrs
        FROM user_lexicon
        JOIN lexical_items ON lexical_items.id = user_lexicon.item_id
        LEFT JOIN segments ON segments.id = user_lexicon.first_context_segment_id
        WHERE user_lexicon.user_id = ${userId} AND lexical_items.type = 'phrase'
          AND (${language ?? null}::text IS NULL OR lexical_items.language = ${language ?? null})`;
      return rows.map((row) => ({
        itemId: row.item_id,
        phrase: row.phrase,
        meaningVi: row.meaning_vi,
        contextEn: row.context_en,
        inReview: row.in_review,
        fsrs: row.receptive_fsrs,
      }));
    },

    async saveAnswer(userId, itemId, fsrs, log) {
      return sql.begin(async (tx) => {
        const updated = await tx`
          UPDATE user_lexicon SET receptive_fsrs = ${tx.json(fsrs)}
          WHERE user_id = ${userId} AND item_id = ${itemId}`;
        if (updated.count === 0) return false;
        await tx`
          INSERT INTO review_logs (user_id, item_id, exercise_type, rating, response_ms, at)
          VALUES (${userId}, ${itemId}, ${log.exercise}, ${log.rating}, ${log.responseMs ?? null}, ${log.at})`;
        return true;
      });
    },

    async progressFacts(userId, language, since) {
      const reviews = await sql<{ at: Date }[]>`
        SELECT review_logs.at FROM review_logs
        JOIN lexical_items ON lexical_items.id = review_logs.item_id
        WHERE review_logs.user_id = ${userId} AND review_logs.at >= ${since}
          AND lexical_items.language = ${language}`;
      const meetings = await sql<{ started_at: Date }[]>`
        SELECT started_at FROM sessions
        WHERE user_id = ${userId} AND started_at >= ${since} AND status <> 'deleted'
          AND language = ${language}`;
      const lookups = await sql<{ at: Date }[]>`
        SELECT events.at FROM events
        JOIN sessions ON sessions.id = events.session_id
        WHERE events.user_id = ${userId} AND events.type = 'lookup' AND events.at >= ${since}
          AND sessions.language = ${language}`;
      const [avg] = await sql<{ pct: number | null }[]>`
        SELECT avg(comprehension_pct)::float AS pct FROM (
          SELECT DISTINCT ON (debriefs.session_id) debriefs.comprehension_pct
          FROM debriefs JOIN sessions ON sessions.id = debriefs.session_id
          WHERE sessions.user_id = ${userId} AND sessions.language = ${language}
            AND debriefs.comprehension_pct IS NOT NULL
          ORDER BY debriefs.session_id, debriefs.version DESC
        ) latest`;
      return {
        reviewTimes: reviews.map((row) => row.at),
        meetingStarts: meetings.map((row) => row.started_at),
        lookupTimes: lookups.map((row) => row.at),
        avgComprehensionPct: avg?.pct ?? null,
      };
    },
  };
}

/** In-memory implementation for tests and local demos; `seed` adds items for a user. */
export function createInMemoryStudyRepository(): StudyRepository & {
  seed(userId: string, item: StudyItem, language?: LanguageCode): void;
  seedFacts(userId: string, facts: Partial<ProgressFacts>, language?: LanguageCode): void;
} {
  const items = new Map<string, Array<StudyItem & { language: LanguageCode }>>();
  const facts = new Map<string, ProgressFacts>();
  const factsKey = (userId: string, language: LanguageCode) => `${userId}:${language}`;
  const empty = (): ProgressFacts => ({
    reviewTimes: [],
    meetingStarts: [],
    lookupTimes: [],
    avgComprehensionPct: null,
  });
  return {
    seed(userId, item, language = DEFAULT_LANGUAGE) {
      items.set(userId, [...(items.get(userId) ?? []), { ...item, language }]);
    },
    seedFacts(userId, partial, language = DEFAULT_LANGUAGE) {
      const key = factsKey(userId, language);
      facts.set(key, { ...empty(), ...facts.get(key), ...partial });
    },
    async listItems(userId, language) {
      return (items.get(userId) ?? [])
        .filter((item) => !language || item.language === language)
        .map(({ language: _language, ...item }) => ({ ...item }));
    },
    async saveAnswer(userId, itemId, fsrs, log) {
      const item = (items.get(userId) ?? []).find((candidate) => candidate.itemId === itemId);
      if (!item) return false;
      item.fsrs = fsrs;
      const key = factsKey(userId, item.language);
      const current = facts.get(key) ?? empty();
      facts.set(key, { ...current, reviewTimes: [...current.reviewTimes, log.at] });
      return true;
    },
    async progressFacts(userId, language, since) {
      const current = facts.get(factsKey(userId, language)) ?? empty();
      const recent = (dates: Date[]) => dates.filter((date) => date >= since);
      return {
        ...current,
        reviewTimes: recent(current.reviewTimes),
        meetingStarts: recent(current.meetingStarts),
        lookupTimes: recent(current.lookupTimes),
      };
    },
  };
}
