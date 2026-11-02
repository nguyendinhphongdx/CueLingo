import { randomUUID } from 'node:crypto';
import { DEFAULT_LANGUAGE, type Phrase } from '@cuelingo/shared';
import type { PhrasesRepository } from './phrases.repository';

/** In-memory implementation with the same user boundaries, for tests and local demos. */
export function createInMemoryPhrasesRepository(): PhrasesRepository {
  const items = new Map<string, string>();
  const rows: Array<Phrase & { userId: string; language: string }> = [];
  const strip = ({
    userId: _userId,
    language: _language,
    ...phrase
  }: Phrase & { userId: string; language: string }): Phrase => phrase;

  return {
    async list(userId, language) {
      return rows
        .filter((row) => row.userId === userId && row.language === language)
        .sort((a, b) => a.phrase.localeCompare(b.phrase))
        .map(strip);
    },

    async save(userId, input) {
      const language = input.language ?? DEFAULT_LANGUAGE;
      const key = `${language}:${input.phrase}`;
      let id = items.get(key);
      if (!id) {
        id = randomUUID();
        items.set(key, id);
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
        language,
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
