import { randomUUID } from 'node:crypto';
import type { Phrase } from '@cuelingo/shared';
import type { PhrasesRepository } from './phrases.repository';

/** In-memory implementation with the same user boundaries, for tests and local demos. */
export function createInMemoryPhrasesRepository(): PhrasesRepository {
  const items = new Map<string, string>();
  const rows: Array<Phrase & { userId: string }> = [];
  const strip = ({ userId: _userId, ...phrase }: Phrase & { userId: string }): Phrase => phrase;

  return {
    async list(userId) {
      return rows
        .filter((row) => row.userId === userId)
        .sort((a, b) => a.phrase.localeCompare(b.phrase))
        .map(strip);
    },

    async save(userId, input) {
      let id = items.get(input.phrase);
      if (!id) {
        id = randomUUID();
        items.set(input.phrase, id);
      }
      const existing = rows.find((row) => row.userId === userId && row.id === id);
      if (existing) {
        if (input.meaningVi !== undefined) existing.meaningVi = input.meaningVi;
        existing.inReview = true;
        return strip(existing);
      }
      const row = {
        id,
        phrase: input.phrase,
        meaningVi: input.meaningVi ?? null,
        inReview: true,
        userId,
      };
      rows.push(row);
      return strip(row);
    },

    async delete(userId, id) {
      const index = rows.findIndex((row) => row.userId === userId && row.id === id);
      if (index === -1) return false;
      rows.splice(index, 1);
      return true;
    },
  };
}
