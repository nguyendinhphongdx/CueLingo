import { randomUUID } from 'node:crypto';
import type { LearningEvent } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

/** Append-only data access for learning events, scoped by the authenticated user's id. */
export interface EventsRepository {
  append(userId: string, events: LearningEvent[]): Promise<void>;
}

function payload(event: LearningEvent): Record<string, string | number> {
  switch (event.type) {
    case 'lookup':
      return { term: event.term };
    case 'compose_used':
      return { chosenIndex: event.chosenIndex };
    case 'phrase_saved':
      return { phrase: event.phrase };
    case 'assist_suggestion':
      return { action: event.action, level: event.level, language: event.language ?? 'en' };
    case 'translation_expanded':
    case 'recap_used':
    case 'app_installed_first_run':
    case 'first_caption_shown':
      return {};
  }
}

export function createPostgresEventsRepository(sql: Sql): EventsRepository {
  return {
    async append(userId, events) {
      await sql.begin(async (tx) => {
        const sessionIds = [...new Set(events.flatMap((event) => event.sessionId ?? []))];
        if (sessionIds.length > 0) {
          const owned = await tx<{ id: string }[]>`
            SELECT id FROM sessions
            WHERE user_id = ${userId} AND id = ANY(${sessionIds}::uuid[])`;
          if (owned.length !== sessionIds.length) throw new Error('Event session not found');
        }

        const segmentIds = [
          ...new Set(
            events.flatMap((event) =>
              event.type === 'translation_expanded' ? [event.segmentId] : [],
            ),
          ),
        ];
        if (segmentIds.length > 0) {
          const owned = await tx<{ id: string }[]>`
            SELECT segments.id FROM segments
            JOIN sessions ON sessions.id = segments.session_id
            WHERE sessions.user_id = ${userId}
              AND segments.id = ANY(${segmentIds}::uuid[])`;
          if (owned.length !== segmentIds.length) throw new Error('Event segment not found');
        }

        for (const event of events) {
          // Activation events happen once per person: a resend (lost response, second device) is dropped.
          if (event.type === 'app_installed_first_run' || event.type === 'first_caption_shown') {
            await tx`
              INSERT INTO events (id, user_id, session_id, type, payload, at)
              SELECT ${randomUUID()}, ${userId}, ${event.sessionId ?? null}, ${event.type}, '{}'::jsonb, ${event.at}
              WHERE NOT EXISTS (
                SELECT 1 FROM events WHERE user_id = ${userId} AND type = ${event.type})`;
            continue;
          }
          await tx`
            INSERT INTO events (id, user_id, session_id, segment_id, type, payload, at)
            VALUES (
              ${randomUUID()},
              ${userId},
              ${event.sessionId ?? null},
              ${event.type === 'translation_expanded' ? event.segmentId : null},
              ${event.type},
              ${tx.json(payload(event))},
              ${event.at}
            )`;
        }
      });
    },
  };
}
