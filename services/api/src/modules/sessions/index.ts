/**
 * Sessions — Vòng đời cuộc họp: tạo, kết thúc, liệt kê, transcript.
 * Design: apps/docs/docs/04-modules/03-api/sessions.md
 */
import type { JobQueue } from '../../lib/queue';
import type { UsageService } from '../usage';
import { sessionsRoutes } from './sessions.routes';
import { createSessionsService } from './sessions.service';
import type { SessionsRepository } from './sessions.repository';

export function createSessionsModule(
  repo: SessionsRepository,
  queue: JobQueue,
  usage: Pick<UsageService, 'tryReserve'>,
) {
  const service = createSessionsService(repo, queue, usage);
  return { service, routes: sessionsRoutes(service) };
}

export type { DebriefState, SaveSegmentInput, SessionsRepository } from './sessions.repository';
export type { SessionsService } from './sessions.service';
export { createPostgresSessionsRepository } from './sessions.repository';
export type { InMemorySessionsRepository } from './sessions.repository.memory';
export { createInMemorySessionsRepository } from './sessions.repository.memory';
