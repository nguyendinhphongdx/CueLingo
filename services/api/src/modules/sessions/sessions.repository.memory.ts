import { randomUUID } from 'node:crypto';
import { DEFAULT_LANGUAGE, type Session, type Speaker, type StoredSegment } from '@cuelingo/shared';
import type { SessionsRepository } from './sessions.repository';

/** The in-memory store also exposes its speaker rows so the in-memory speakers repository can share them. */
export type InMemorySessionsRepository = SessionsRepository & {
  speakerRows: Array<Speaker & { sessionId: string }>;
};

/** In-memory session and segment store for tests. */
export function createInMemorySessionsRepository(): InMemorySessionsRepository {
  const sessions: Array<Session & { userId: string }> = [];
  const segments: Array<StoredSegment & { sessionId: string }> = [];
  const speakerRows: Array<Speaker & { sessionId: string }> = [];
  const strip = ({ userId: _userId, ...session }: Session & { userId: string }): Session => session;

  return {
    speakerRows,
    async list(userId) {
      return sessions
        .filter((row) => row.userId === userId && row.status !== 'deleted')
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
        .reverse()
        .map(strip);
    },
    async findById(userId, id) {
      const row = sessions.find(
        (item) => item.userId === userId && item.id === id && item.status !== 'deleted',
      );
      return row ? strip(row) : null;
    },
    async findDetail(userId, id) {
      const row = sessions.find(
        (item) => item.userId === userId && item.id === id && item.status !== 'deleted',
      );
      if (!row) return null;
      return {
        ...strip(row),
        segments: segments
          .filter((segment) => segment.sessionId === id)
          .sort((a, b) => a.startMs - b.startMs)
          .map(({ sessionId: _sessionId, ...segment }) => segment),
        speakers: speakerRows
          .filter((speaker) => speaker.sessionId === id)
          .sort(
            (a, b) =>
              Number(b.label === 'me') - Number(a.label === 'me') || a.label.localeCompare(b.label),
          )
          .map(({ sessionId: _sessionId, ...speaker }) => speaker),
      };
    },
    async findDebriefState(userId, id) {
      const row = sessions.find(
        (item) => item.userId === userId && item.id === id && item.status !== 'deleted',
      );
      if (!row) return null;
      return {
        status: row.status,
        segmentCount: segments.filter((segment) => segment.sessionId === id).length,
      };
    },
    async create(userId, input) {
      const row: Session & { userId: string } = {
        id: randomUUID(),
        title: input.title ?? null,
        startedAt: new Date().toISOString(),
        endedAt: null,
        status: 'live',
        assistLevel: input.assistLevel,
        language: input.language ?? DEFAULT_LANGUAGE,
        userId,
      };
      sessions.push(row);
      return strip(row);
    },
    async end(userId, id) {
      const row = sessions.find(
        (item) => item.userId === userId && item.id === id && item.status !== 'deleted',
      );
      if (!row) return null;
      if (row.status !== 'live') return { session: strip(row), endedNow: false };
      row.status = 'ended';
      row.endedAt = new Date().toISOString();
      return { session: strip(row), endedNow: true };
    },
    async softDelete(userId, id) {
      const row = sessions.find(
        (item) => item.userId === userId && item.id === id && item.status !== 'deleted',
      );
      if (!row) return false;
      row.status = 'deleted';
      row.endedAt = new Date().toISOString();
      return true;
    },
    async setLanguage(userId, id, language) {
      const row = sessions.find(
        (item) => item.userId === userId && item.id === id && item.status !== 'deleted',
      );
      if (!row) return null;
      row.language = language;
      return strip(row);
    },
    async saveSegment(input) {
      if (
        !sessions.some(
          (row) =>
            row.id === input.sessionId && row.userId === input.userId && row.status !== 'deleted',
        )
      ) {
        return false;
      }
      const existing = segments.find((row) => row.id === input.segmentId);
      if (existing) return existing.sessionId === input.sessionId;
      let speakerId: string | null = null;
      if (input.speaker) {
        let speaker = speakerRows.find(
          (row) => row.sessionId === input.sessionId && row.label === input.speaker,
        );
        if (!speaker) {
          speaker = {
            id: randomUUID(),
            sessionId: input.sessionId,
            label: input.speaker,
            displayName: null,
          };
          speakerRows.push(speaker);
        }
        speakerId = speaker.id;
      }
      segments.push({
        id: input.segmentId,
        sessionId: input.sessionId,
        source: input.source,
        startMs: input.startMs,
        endMs: input.endMs,
        textEn: input.textEn,
        textVi: null,
        speakerId,
      });
      return true;
    },
    async saveTranslation(segmentId, textVi) {
      const row = segments.find((item) => item.id === segmentId);
      if (row) row.textVi = textVi;
    },
  };
}
