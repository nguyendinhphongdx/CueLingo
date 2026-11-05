import { randomUUID } from 'node:crypto';
import type { CreateFeedbackRequest } from '@cuelingo/shared';
import type { FeedbackRepository } from './feedback.repository';

/** In-memory implementation; `rows` lets tests see exactly what would have been stored. */
export function createInMemoryFeedbackRepository(): FeedbackRepository & {
  rows: Array<CreateFeedbackRequest & { id: string; userId: string; createdAt: string }>;
} {
  const rows: Array<CreateFeedbackRequest & { id: string; userId: string; createdAt: string }> = [];
  return {
    rows,
    async create(userId, input) {
      const row = { ...input, id: randomUUID(), userId, createdAt: new Date().toISOString() };
      rows.push(row);
      return { id: row.id, createdAt: row.createdAt };
    },
    async countSince(userId, since) {
      return rows.filter((r) => r.userId === userId && new Date(r.createdAt) >= since).length;
    },
  };
}
