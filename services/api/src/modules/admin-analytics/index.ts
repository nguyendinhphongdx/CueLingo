/**
 * Admin analytics module — aggregate statistics for the admin console (spec 2026-11-16-admin-console).
 * Design: apps/docs/docs/04-modules/03-api/admin-analytics.md
 */
import { adminAnalyticsRoutes } from './admin-analytics.routes';
import { createAdminAnalyticsService, type AdminAnalyticsOptions } from './admin-analytics.service';
import type { AdminAnalyticsRepository } from './admin-analytics.repository';

export function createAdminAnalyticsModule(
  repo: AdminAnalyticsRepository,
  options: AdminAnalyticsOptions,
) {
  const service = createAdminAnalyticsService(repo, options);
  return { service, routes: adminAnalyticsRoutes(service) };
}

export type { AdminAnalyticsRepository } from './admin-analytics.repository';
export type { AdminAnalyticsService } from './admin-analytics.service';
export { createPostgresAdminAnalyticsRepository } from './admin-analytics.repository';
export {
  createInMemoryAdminAnalyticsRepository,
  type InMemoryAnalyticsValues,
} from './admin-analytics.repository.memory';
