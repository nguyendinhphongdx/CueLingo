/**
 * Sessions — Vòng đời cuộc họp: tạo, kết thúc, liệt kê, transcript.
 * Design: apps/docs/docs/04-modules/03-api/sessions.md
 */
import type { JobQueue } from '../../lib/queue';
import { sessionsRoutes } from './sessions.routes';
import { createSessionsService } from './sessions.service';
import type { SessionsRepository } from './sessions.repository';

export function createSessionsModule(repo: SessionsRepository, queue: JobQueue) {
  const service = createSessionsService(repo, queue);
  return { service, routes: sessionsRoutes(service) };
}

export type { SaveSegmentInput, SessionsRepository } from './sessions.repository';
export type { SessionsService } from './sessions.service';
export { createPostgresSessionsRepository } from './sessions.repository';
export { createInMemorySessionsRepository } from './sessions.repository.memory';
