import { ErrorCode, type Speaker } from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { SpeakersRepository } from './speakers.repository';

export type SpeakersService = ReturnType<typeof createSpeakersService>;

/** Business rules for naming the people of a meeting: only others can be renamed, `me` is always "Tôi". */
export function createSpeakersService(repo: SpeakersRepository) {
  return {
    async rename(
      userId: string,
      sessionId: string,
      speakerId: string,
      displayName: string | null,
    ): Promise<Speaker> {
      const current = await repo.find(userId, sessionId, speakerId);
      if (!current) throw new AppError(ErrorCode.NotFound, 'Speaker not found');
      if (current.label === 'me') {
        throw new AppError(ErrorCode.Validation, 'The user cannot be renamed');
      }
      const updated = await repo.rename(userId, sessionId, speakerId, displayName);
      if (!updated) throw new AppError(ErrorCode.NotFound, 'Speaker not found');
      return updated;
    },
  };
}
