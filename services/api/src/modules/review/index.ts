/**
 * Phrases & review — Phrase Bank và hàng đợi ôn tập FSRS.
 * Design: apps/docs/docs/04-modules/03-api/phrases-review.md
 */
import { phrasesRoutes } from './phrases.routes';
import { createPhrasesService } from './phrases.service';
import type { PhrasesRepository } from './phrases.repository';

export function createReviewModule(repo: PhrasesRepository) {
  const phrases = createPhrasesService(repo);
  return { phrases, routes: phrasesRoutes(phrases) };
}

export type { PhrasesRepository } from './phrases.repository';
export type { PhrasesService } from './phrases.service';
export { createPostgresPhrasesRepository } from './phrases.repository';
export { createInMemoryPhrasesRepository } from './phrases.repository.memory';
