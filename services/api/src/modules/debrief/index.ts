/**
 * Debrief — Đọc kết quả debrief do worker tạo, nhận phản hồi.
 * Design: apps/docs/docs/04-modules/03-api/debrief.md
 */
import { debriefRoutes } from './debrief.routes';
import { createDebriefService } from './debrief.service';
import type { DebriefRepository } from './debrief.repository';

export function createDebriefModule(repo: DebriefRepository) {
  const service = createDebriefService(repo);
  return { service, routes: debriefRoutes(service) };
}

export type { DebriefRepository } from './debrief.repository';
export type { DebriefService } from './debrief.service';
export { createPostgresDebriefRepository } from './debrief.repository';
export { createInMemoryDebriefRepository } from './debrief.repository.memory';
