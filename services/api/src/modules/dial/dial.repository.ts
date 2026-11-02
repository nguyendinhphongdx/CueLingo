import type { AssistLevel, MeetingOutcome } from '@cuelingo/learner-model';
import type { Sql } from '../../lib/db';

export interface DialFacts {
  currentLevel: AssistLevel;
  /** Recent meetings, newest first. */
  meetings: MeetingOutcome[];
  /** When the person last applied or dismissed a suggestion. */
  lastDecisionAt: string | null;
}

/** Reads what the assist suggestion is based on. Scoped by the authenticated user's id. */
export interface DialRepository {
  facts(userId: string): Promise<DialFacts>;
}

const LEVELS: readonly number[] = [4, 3, 1, 0];

export function createPostgresDialRepository(sql: Sql): DialRepository {
  return {
    async facts(userId) {
      const [profile] = await sql<{ assist_default: number }[]>`
        SELECT assist_default FROM learner_profiles WHERE user_id = ${userId}`;
      const meetings = await sql<
        { started_at: Date; comprehension_pct: number | null; lookups: string }[]
      >`
        SELECT s.started_at, d.comprehension_pct,
               (SELECT count(*) FROM events e
                WHERE e.session_id = s.id AND e.type = 'lookup')::text AS lookups
        FROM sessions s
        LEFT JOIN LATERAL (
          SELECT comprehension_pct FROM debriefs
          WHERE session_id = s.id ORDER BY version DESC LIMIT 1
        ) d ON true
        WHERE s.user_id = ${userId} AND s.status <> 'deleted'
        ORDER BY s.started_at DESC LIMIT 6`;
      const [decision] = await sql<{ at: Date }[]>`
        SELECT at FROM events
        WHERE user_id = ${userId} AND type = 'assist_suggestion'
        ORDER BY at DESC LIMIT 1`;

      const level = profile?.assist_default ?? 4;
      return {
        currentLevel: (LEVELS.includes(level) ? level : 4) as AssistLevel,
        meetings: meetings.map((row) => ({
          comprehensionPct: row.comprehension_pct,
          lookups: Number(row.lookups),
          startedAt: row.started_at.toISOString(),
        })),
        lastDecisionAt: decision?.at.toISOString() ?? null,
      };
    },
  };
}

/** In-memory implementation for tests; `set` replaces what the user's facts are. */
export function createInMemoryDialRepository(): DialRepository & {
  set(userId: string, facts: DialFacts): void;
} {
  const store = new Map<string, DialFacts>();
  return {
    set: (userId, facts) => void store.set(userId, facts),
    async facts(userId) {
      return store.get(userId) ?? { currentLevel: 4, meetings: [], lastDecisionAt: null };
    },
  };
}
