/**
 * Usage module — plans, billing counters and the quota gate (spec 2026-11-14-w2-02-plans-quota).
 * Design: apps/docs/docs/04-modules/03-api/usage.md · ADR 0022
 */
import { usageRoutes } from './usage.routes';
import { createUsageService, type UsageOptions } from './usage.service';
import type { UsageRepository } from './usage.repository';

export function createUsageModule(repo: UsageRepository, options: UsageOptions) {
  const service = createUsageService(repo, options);
  return { service, routes: usageRoutes(service) };
}

export type { UsageRepository } from './usage.repository';
export type { PlanChange, ReserveResult, UsageLog, UsageService } from './usage.service';
export { createPostgresUsageRepository } from './usage.repository';
export { createInMemoryUsageRepository } from './usage.repository.memory';
export type { InMemoryPlanRows } from './usage.repository.memory';
