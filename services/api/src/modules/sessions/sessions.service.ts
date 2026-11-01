import { ErrorCode, JobName, type CreateSessionRequest, type Session } from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { JobQueue } from '../../lib/queue';
import type { SessionsRepository } from './sessions.repository';

export type SessionsService = ReturnType<typeof createSessionsService>;

export function createSessionsService(repo: SessionsRepository, queue: JobQueue) {
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
      if (result.endedNow) await queue.enqueue(JobName.DebriefGenerate, { sessionId: id });
      return result.session;
    },
    async remove(userId: string, id: string): Promise<void> {
      if (!(await repo.softDelete(userId, id))) {
        throw new AppError(ErrorCode.NotFound, 'Session not found');
      }
    },
  };
}
