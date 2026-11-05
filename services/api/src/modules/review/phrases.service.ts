import {
  ErrorCode,
  normalizePhrase,
  type LanguageCode,
  type Phrase,
  type SavePhraseRequest,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { PhrasesRepository } from './phrases.repository';

export type PhrasesService = ReturnType<typeof createPhrasesService>;

export function createPhrasesService(repo: PhrasesRepository) {
  return {
    list(userId: string, language: LanguageCode): Promise<Phrase[]> {
      return repo.list(userId, language);
    },

    save(userId: string, input: SavePhraseRequest): Promise<Phrase> {
      return repo.save(userId, { ...input, phrase: normalizePhrase(input.phrase) });
    },

    async remove(userId: string, id: string): Promise<void> {
      if (!(await repo.delete(userId, id))) {
        throw new AppError(ErrorCode.NotFound, 'Phrase not found');
      }
    },
  };
}
