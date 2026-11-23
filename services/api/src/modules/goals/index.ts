/**
 * Goals — goals picked from the catalog and their AI-made lessons (shared content, personal progress).
 * Design: apps/docs/docs/04-modules/03-api/goals.md · Pattern: modules/glossary · ADR 0025
 */
import { goalsRoutes } from './goals.routes';
import { createGoalsService, type GoalsDeps, type GoalsPorts } from './goals.service';
import type { GoalsRepository } from './goals.repository';

export function createGoalsModule(repo: GoalsRepository, ports: GoalsPorts, deps: GoalsDeps = {}) {
  const service = createGoalsService(repo, ports, deps);
  return { service, routes: goalsRoutes(service) };
}

export type { GoalsRepository } from './goals.repository';
export type { GoalsDeps, GoalsPorts, GoalsService } from './goals.service';
export { createPostgresGoalsRepository } from './goals.repository';
export type { InMemoryGoalsRepository } from './goals.repository.memory';
export { createInMemoryGoalsRepository } from './goals.repository.memory';
