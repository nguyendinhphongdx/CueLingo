import type { CreateFeedbackRequest, Feedback } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

/** Write-only data access for tester feedback. There is deliberately no read for users (spec G6). */
export interface FeedbackRepository {
  create(userId: string, input: CreateFeedbackRequest): Promise<Feedback>;
  countSince(userId: string, since: Date): Promise<number>;
}

export function createPostgresFeedbackRepository(sql: Sql): FeedbackRepository {
  return {
    async create(userId, input) {
      const [row] = await sql<{ id: string; created_at: Date }[]>`
        INSERT INTO feedback (user_id, kind, message, client, app_version, os)
        VALUES (${userId}, ${input.kind}, ${input.message}, ${input.client}, ${input.appVersion}, ${input.os})
        RETURNING id, created_at`;
      return { id: row!.id, createdAt: row!.created_at.toISOString() };
    },
    async countSince(userId, since) {
      const [row] = await sql<{ count: number }[]>`
        SELECT count(*)::integer AS count FROM feedback
        WHERE user_id = ${userId} AND created_at >= ${since}`;
      return row?.count ?? 0;
    },
  };
}
