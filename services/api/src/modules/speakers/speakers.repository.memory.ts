import type { InMemorySessionsRepository } from '../sessions';
import type { SpeakersRepository } from './speakers.repository';

/** In-memory implementation over the in-memory sessions store (it owns the speaker rows), for tests. */
export function createInMemorySpeakersRepository(
  sessions: Pick<InMemorySessionsRepository, 'speakerRows' | 'findById'>,
): SpeakersRepository {
  const strip = ({ sessionId: _sessionId, ...speaker }: (typeof sessions.speakerRows)[number]) =>
    speaker;
  const owned = async (userId: string, sessionId: string, speakerId: string) => {
    if (!(await sessions.findById(userId, sessionId))) return undefined;
    return sessions.speakerRows.find((row) => row.sessionId === sessionId && row.id === speakerId);
  };

  return {
    async find(userId, sessionId, speakerId) {
      const row = await owned(userId, sessionId, speakerId);
      return row ? strip(row) : null;
    },
    async rename(userId, sessionId, speakerId, displayName) {
      const row = await owned(userId, sessionId, speakerId);
      if (!row || row.label === 'me') return null;
      row.displayName = displayName;
      return strip(row);
    },
  };
}
