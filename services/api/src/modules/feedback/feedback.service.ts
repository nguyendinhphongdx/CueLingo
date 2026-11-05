import { ErrorCode, type CreateFeedbackRequest, type Feedback } from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { FeedbackRepository } from './feedback.repository';

export type FeedbackService = ReturnType<typeof createFeedbackService>;

const HOUR_MS = 60 * 60 * 1000;
export const FEEDBACK_PER_HOUR = 10;

export function createFeedbackService(
  repo: FeedbackRepository,
  now: () => Date = () => new Date(),
) {
  return {
    /** Stores one piece of feedback; ten an hour per person is far more than a tester needs. */
    async create(userId: string, input: CreateFeedbackRequest): Promise<Feedback> {
      const recent = await repo.countSince(userId, new Date(now().getTime() - HOUR_MS));
      if (recent >= FEEDBACK_PER_HOUR) {
        throw new AppError(ErrorCode.RateLimited, 'Too many feedback messages');
      }
      return repo.create(userId, input);
    },
  };
}
