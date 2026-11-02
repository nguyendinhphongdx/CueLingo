/**
 * Dial — Gợi ý đổi mức hỗ trợ (Assist Dial) từ kết quả các cuộc họp gần đây. Luật nằm ở @cuelingo/learner-model.
 */
import { dialRoutes } from './dial.routes';
import { createDialService } from './dial.service';
import type { DialRepository } from './dial.repository';

export function createDialModule(repo: DialRepository) {
  const dial = createDialService(repo);
  return { dial, routes: dialRoutes(dial) };
}

export type { DialRepository } from './dial.repository';
export { createInMemoryDialRepository, createPostgresDialRepository } from './dial.repository';
