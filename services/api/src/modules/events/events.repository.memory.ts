import type { LearningEvent } from '@cuelingo/shared';
import type { EventsRepository } from './events.repository';

/** In-memory append-only implementation for tests and local demos. */
export function createInMemoryEventsRepository(): EventsRepository {
  const rows: Array<LearningEvent & { userId: string }> = [];

  return {
    async append(userId, events) {
      rows.push(...events.map((event) => ({ ...event, userId })));
    },
  };
}
