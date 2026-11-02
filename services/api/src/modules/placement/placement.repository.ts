import type { AssistLevel, ListeningLevel } from '@cuelingo/learner-model';
import type { LanguageCode } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

/** Saves a placement result as the person's level and starting assist level for one language. */
export interface PlacementRepository {
  save(
    userId: string,
    language: LanguageCode,
    result: { listeningLevel: ListeningLevel; assistDefault: AssistLevel },
  ): Promise<void>;
}

export function createPostgresPlacementRepository(sql: Sql): PlacementRepository {
  return {
    async save(userId, language, result) {
      await sql`
        INSERT INTO learner_languages (user_id, language, listening_level, assist_default)
        VALUES (${userId}, ${language}, ${result.listeningLevel}, ${result.assistDefault})
        ON CONFLICT (user_id, language) DO UPDATE
          SET listening_level = EXCLUDED.listening_level,
              assist_default = EXCLUDED.assist_default`;
    },
  };
}

export function createInMemoryPlacementRepository(): PlacementRepository & {
  saved(
    userId: string,
    language: LanguageCode,
  ): { listeningLevel: string; assistDefault: number } | undefined;
} {
  const store = new Map<string, { listeningLevel: string; assistDefault: number }>();
  return {
    async save(userId, language, result) {
      store.set(`${userId}:${language}`, { ...result });
    },
    saved: (userId, language) => store.get(`${userId}:${language}`),
  };
}
