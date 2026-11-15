import { DEFAULT_PLAN, USAGE_METRICS, type Plan } from '@cuelingo/shared';
import type { UsageAmounts, UsageRepository } from './usage.repository';

/** In-memory implementation with the same contract. `emails` maps user id to email, like the admin repository. */
export function createInMemoryUsageRepository(
  emails: Readonly<Record<string, string>> = {},
): UsageRepository {
  const plans = new Map<string, Plan>();
  const counters = new Map<string, number>();
  const key = (userId: string, metric: string, start: Date) =>
    `${userId}|${metric}|${start.toISOString()}`;

  return {
    async snapshot(userId, starts) {
      const amounts = Object.fromEntries(
        USAGE_METRICS.map((m) => [m, counters.get(key(userId, m, starts[m])) ?? 0]),
      ) as UsageAmounts;
      return { plan: plans.get(userId) ?? DEFAULT_PLAN, amounts };
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
    async setPlan(userId, plan) {
      plans.set(userId, plan);
    },
    async userIdByEmail(email) {
      const target = email.toLowerCase();
      const found = Object.entries(emails).find(([, value]) => value.toLowerCase() === target);
      return found?.[0] ?? null;
    },
  };
}
