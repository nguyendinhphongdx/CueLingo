import { randomUUID } from 'node:crypto';
import type { GlossaryTerm } from '@cuelingo/shared';
import type { GlossaryRepository } from './glossary.repository';

/** In-memory implementation with the same contract, for tests and local demos. */
export function createInMemoryGlossaryRepository(): GlossaryRepository {
  const rows: Array<GlossaryTerm & { userId: string }> = [];
  const strip = ({ userId: _userId, ...term }: GlossaryTerm & { userId: string }): GlossaryTerm =>
    term;
  const own = (userId: string) => rows.filter((r) => r.userId === userId);

  return {
    async list(userId, language) {
      return own(userId)
        .filter((r) => r.language === language)
        .sort((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase()))
        .map(strip);
    },
    async findById(userId, id) {
      const row = own(userId).find((r) => r.id === id);
      return row ? strip(row) : null;
    },
    async findByTerm(userId, language, term) {
      const row = own(userId).find(
        (r) => r.language === language && r.term.toLowerCase() === term.toLowerCase(),
      );
      return row ? strip(row) : null;
    },
    async create(userId, input) {
      const row = { ...input, id: randomUUID(), createdAt: new Date().toISOString(), userId };
      rows.push(row);
      return strip(row);
    },
    async update(userId, id, patch) {
      const row = own(userId).find((r) => r.id === id);
      if (!row) return null;
      Object.assign(row, patch);
      return strip(row);
    },
    async delete(userId, id) {
      const index = rows.findIndex((r) => r.userId === userId && r.id === id);
      if (index === -1) return false;
      rows.splice(index, 1);
      return true;
    },
  };
}
