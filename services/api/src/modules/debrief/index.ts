/**
 * Debrief — Đọc kết quả debrief do worker tạo, nhận phản hồi.
 * Design: apps/docs/docs/04-modules/03-api/debrief.md
 */
import type { SessionsRepository } from '../sessions';
import { debriefRoutes } from './debrief.routes';
import { createDebriefService } from './debrief.service';
import type { DebriefRepository } from './debrief.repository';

export function createDebriefModule(
  repo: DebriefRepository,
  sessions: Pick<SessionsRepository, 'findDebriefState'>,
) {
  const service = createDebriefService(repo, sessions);
  return { service, routes: debriefRoutes(service) };
}

export type { DebriefRepository } from './debrief.repository';
export type { DebriefService } from './debrief.service';
export { createPostgresDebriefRepository } from './debrief.repository';
export type { InMemoryDebriefRepository } from './debrief.repository.memory';
export { createInMemoryDebriefRepository } from './debrief.repository.memory';
