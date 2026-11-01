import type { LearningEvent } from '@cuelingo/shared';
import type { EventsRepository } from './events.repository';

export type EventsService = ReturnType<typeof createEventsService>;

/** Appends validated learning events as one repository operation. */
export function createEventsService(repo: EventsRepository) {
  return {
    append(userId: string, events: LearningEvent[]): Promise<void> {
      return repo.append(userId, events);
    },
  };
}
