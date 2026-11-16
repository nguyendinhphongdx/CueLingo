import { USAGE_METRICS, effectivePlan, type PlanRow } from '@cuelingo/shared';
import type { UsageAmounts, UsageRepository } from './usage.repository';

/** Plan rows by user id. The in-memory billing repository shares this map so a paid order changes the plan. */
export type InMemoryPlanRows = Map<string, PlanRow>;

/**
 * In-memory implementation with the same contract. `emails` maps user id to email, like the admin repository.
 * Pass `plans` to share plan rows with another in-memory repository.
 */
export function createInMemoryUsageRepository(
  emails: Readonly<Record<string, string>> = {},
  plans: InMemoryPlanRows = new Map(),
): UsageRepository {
  const counters = new Map<string, number>();
  const key = (userId: string, metric: string, start: Date) =>
    `${userId}|${metric}|${start.toISOString()}`;

  return {
    async snapshot(userId, starts, now) {
      const amounts = Object.fromEntries(
        USAGE_METRICS.map((m) => [m, counters.get(key(userId, m, starts[m])) ?? 0]),
      ) as UsageAmounts;
      return { plan: effectivePlan(plans.get(userId) ?? null, now), amounts };
    },
    async gate(userId, metric, periodStart, now) {
      return {
        plan: effectivePlan(plans.get(userId) ?? null, now),
        amount: counters.get(key(userId, metric, periodStart)) ?? 0,
      };
    },
    async reserve(userId, metric, periodStart, amount, limit) {
      const k = key(userId, metric, periodStart);
      const current = counters.get(k);
      if (current !== undefined && current >= limit) return null;
      const next = (current ?? 0) + amount;
      counters.set(k, next);
      return next;
    },
    async add(userId, metric, periodStart, amount) {
      const k = key(userId, metric, periodStart);
      const next = (counters.get(k) ?? 0) + amount;
      counters.set(k, next);
      return next;
    },
    async userIdByEmail(email) {
      const target = email.toLowerCase();
      const found = Object.entries(emails).find(([, value]) => value.toLowerCase() === target);
      return found?.[0] ?? null;
    },
  };
}
