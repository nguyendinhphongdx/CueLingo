import { ErrorCode, type DebriefFeedbackRequest } from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { SessionsRepository } from '../sessions';
import type { DebriefRepository } from './debrief.repository';

export type DebriefService = ReturnType<typeof createDebriefService>;

export function createDebriefService(
  repo: DebriefRepository,
  sessions: Pick<SessionsRepository, 'findDebriefState'>,
) {
  return {
    async latest(userId: string, sessionId: string) {
      const debrief = await repo.findLatest(userId, sessionId);
      if (debrief) return debrief;
      // Still a 404, with a code of its own: old clients read "not ready", new ones read the reason (AC7).
      const state = await sessions.findDebriefState(userId, sessionId);
      if (state?.debriefSkipped) {
        throw new AppError(
          ErrorCode.DebriefSkipped,
          'No debrief: the monthly allowance was used up',
          {
            reason: state.debriefSkipped,
          },
        );
      }
      throw new AppError(ErrorCode.NotFound, 'Debrief not found');
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
