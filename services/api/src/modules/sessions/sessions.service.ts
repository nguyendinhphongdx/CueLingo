import {
  ErrorCode,
  JobName,
  debriefJobOptions,
  type CreateSessionRequest,
  type LanguageCode,
  type Session,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { JobQueue } from '../../lib/queue';
import type { SessionsRepository } from './sessions.repository';

export type SessionsService = ReturnType<typeof createSessionsService>;

export interface SessionsServiceOptions {
  /** Debrief requests one person may make per `windowMs`. */
  maxDebriefRequests?: number;
  windowMs?: number;
  clock?: () => number;
}

export function createSessionsService(
  repo: SessionsRepository,
  queue: JobQueue,
  { maxDebriefRequests = 3, windowMs = 60_000, clock = Date.now }: SessionsServiceOptions = {},
) {
  // In memory and per process: it only stops one account from hammering the button.
  const recent = new Map<string, number[]>();

  function takeSlot(userId: string) {
    const now = clock();
    const times = (recent.get(userId) ?? []).filter((time) => now - time < windowMs);
    if (times.length >= maxDebriefRequests) {
      recent.set(userId, times);
      throw new AppError(ErrorCode.RateLimited, 'Too many debrief requests, slow down');
    }
    recent.delete(userId);
    recent.set(userId, [...times, now]);
    // Bound memory: forget users whose whole window has passed.
    if (recent.size > 5_000) {
      for (const [id, stamps] of recent) {
        if (stamps.every((time) => now - time >= windowMs)) recent.delete(id);
      }
    }
  }

  return {
    list(userId: string) {
      return repo.list(userId);
    },
    create(userId: string, input: CreateSessionRequest) {
      return repo.create(userId, input);
    },
    async detail(userId: string, id: string) {
      const detail = await repo.findDetail(userId, id);
      if (!detail) throw new AppError(ErrorCode.NotFound, 'Session not found');
      return detail;
    },
    async end(userId: string, id: string): Promise<Session> {
      const result = await repo.end(userId, id);
      if (!result) throw new AppError(ErrorCode.NotFound, 'Session not found');
      if (result.endedNow) {
        await queue.enqueue(JobName.DebriefGenerate, { sessionId: id }, debriefJobOptions(id));
      }
      return result.session;
    },
    /** Queues the debrief again for a finished meeting with a transcript (a failed run, or a fresh one). */
    async regenerateDebrief(userId: string, id: string): Promise<{ queued: true }> {
      const state = await repo.findDebriefState(userId, id);
      if (!state) throw new AppError(ErrorCode.NotFound, 'Session not found');
      if (state.status === 'live') {
        throw new AppError(ErrorCode.Conflict, 'The meeting is still running');
      }
      if (state.segmentCount === 0) {
        throw new AppError(ErrorCode.Conflict, 'The meeting has no transcript to summarise');
      }
      takeSlot(userId);
      await queue.enqueue(JobName.DebriefGenerate, { sessionId: id }, debriefJobOptions(id));
      return { queued: true };
    },
    async setLanguage(userId: string, id: string, language: LanguageCode): Promise<Session> {
      const session = await repo.setLanguage(userId, id, language);
      if (!session) throw new AppError(ErrorCode.NotFound, 'Session not found');
      return session;
    },
    async remove(userId: string, id: string): Promise<void> {
      if (!(await repo.softDelete(userId, id))) {
        throw new AppError(ErrorCode.NotFound, 'Session not found');
      }
    },
  };
}
