/**
 * Events — Nhận và kiểm tra event học tập/sản phẩm, ghi vào bảng `events` (append-only).
 * Design: apps/docs/docs/04-modules/03-api/events.md
 */
import { eventsRoutes } from './events.routes';
import { createEventsService } from './events.service';
import type { EventsRepository } from './events.repository';

export function createEventsModule(repo: EventsRepository) {
  const service = createEventsService(repo);
  return { service, routes: eventsRoutes(service) };
}

export type { EventsRepository } from './events.repository';
export type { EventsService } from './events.service';
export { createPostgresEventsRepository } from './events.repository';
export { createInMemoryEventsRepository } from './events.repository.memory';
