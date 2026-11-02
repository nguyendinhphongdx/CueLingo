import {
  ErrorCode,
  type CreateGlossaryTerm,
  type GlossaryTerm,
  type LanguageCode,
  type UpdateGlossaryTerm,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { GlossaryRepository } from './glossary.repository';

export type GlossaryService = ReturnType<typeof createGlossaryService>;

/** Business rules for glossary terms: one entry per term (case-insensitive) per user. */
export function createGlossaryService(repo: GlossaryRepository) {
  async function assertTermFree(
    userId: string,
    language: LanguageCode,
    term: string,
    exceptId?: string,
  ): Promise<void> {
    const existing = await repo.findByTerm(userId, language, term);
    if (existing && existing.id !== exceptId) {
      throw new AppError(ErrorCode.Conflict, `Term "${term}" already exists`);
    }
  }

  return {
    list(userId: string, language: LanguageCode): Promise<GlossaryTerm[]> {
      return repo.list(userId, language);
    },

    async create(userId: string, input: CreateGlossaryTerm): Promise<GlossaryTerm> {
      await assertTermFree(userId, input.language, input.term);
      return repo.create(userId, input);
    },

    async update(userId: string, id: string, patch: UpdateGlossaryTerm): Promise<GlossaryTerm> {
      if (patch.term) {
        // A term is unique within its own language, so check against the language it already has.
        const current = await repo.findById(userId, id);
        if (!current) throw new AppError(ErrorCode.NotFound, 'Glossary term not found');
        await assertTermFree(userId, current.language, patch.term, id);
      }
      const updated = await repo.update(userId, id, patch);
      if (!updated) throw new AppError(ErrorCode.NotFound, 'Glossary term not found');
      return updated;
    },

    async remove(userId: string, id: string): Promise<void> {
      if (!(await repo.delete(userId, id))) {
        throw new AppError(ErrorCode.NotFound, 'Glossary term not found');
      }
    },
  };
}
