import {
  ErrorCode,
  type CreateGlossaryTerm,
  type GlossaryTerm,
  type UpdateGlossaryTerm,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { GlossaryRepository } from './glossary.repository';

export type GlossaryService = ReturnType<typeof createGlossaryService>;

/** Business rules for glossary terms: one entry per term (case-insensitive) per user. */
export function createGlossaryService(repo: GlossaryRepository) {
  async function assertTermFree(userId: string, term: string, exceptId?: string): Promise<void> {
    const existing = await repo.findByTerm(userId, term);
    if (existing && existing.id !== exceptId) {
      throw new AppError(ErrorCode.Conflict, `Term "${term}" already exists`);
    }
  }

  return {
    list(userId: string): Promise<GlossaryTerm[]> {
      return repo.list(userId);
    },

    async create(userId: string, input: CreateGlossaryTerm): Promise<GlossaryTerm> {
      await assertTermFree(userId, input.term);
      return repo.create(userId, input);
    },

    async update(userId: string, id: string, patch: UpdateGlossaryTerm): Promise<GlossaryTerm> {
      if (patch.term) await assertTermFree(userId, patch.term, id);
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
