import { ErrorCode, type DebriefFeedbackRequest } from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { DebriefRepository } from './debrief.repository';

export type DebriefService = ReturnType<typeof createDebriefService>;

export function createDebriefService(repo: DebriefRepository) {
  return {
    async latest(userId: string, sessionId: string) {
      const debrief = await repo.findLatest(userId, sessionId);
      if (!debrief) throw new AppError(ErrorCode.NotFound, 'Debrief not found');
      return debrief;
    },
    async feedback(
      userId: string,
      debriefId: string,
      input: DebriefFeedbackRequest,
    ): Promise<void> {
      if (!(await repo.saveFeedback(userId, debriefId, input))) {
        throw new AppError(ErrorCode.NotFound, 'Debrief not found');
      }
    },
  };
}
