import type { PlanLimitTable } from '@cuelingo/shared';
import {
  buildRevenue,
  buildUsage,
  type ActivityPart,
  type AdminAnalyticsRepository,
  type OverviewPart,
  type RevenuePart,
  type UsagePart,
} from './admin-analytics.repository';

const DAY_MS = 86_400_000;

/** The last `n` UTC days ending at `now` (the memory repository does not model Vietnam time). */
const lastDays = <T>(now: Date, n: number, make: (date: string) => T): T[] =>
  Array.from({ length: n }, (_, i) =>
    make(new Date(now.getTime() - (n - 1 - i) * DAY_MS).toISOString().slice(0, 10)),
  );

export interface InMemoryAnalyticsValues {
  overview?: Partial<OverviewPart>;
  revenue?: Partial<RevenuePart>;
  usage?: Partial<UsagePart>;
  activity?: Partial<ActivityPart>;
}

/** Fixed values (empty by default): the SQL is checked by the int test, like `admin.repository.memory.ts`. */
export function createInMemoryAdminAnalyticsRepository(
  values: InMemoryAnalyticsValues = {},
): AdminAnalyticsRepository {
  return {
    async overview(now) {
      return {
        newUsers: { d7: 0, d30: 0 },
        activeUsers: { d1: 0, d7: 0, d30: 0 },
        daily: lastDays(now, 30, (date) => ({ date, newUsers: 0, activeUsers: 0 })),
        ...values.overview,
      };
    },
    async revenue(now) {
      const base = buildRevenue({
        daily: lastDays(now, 30, (date) => ({ date, amount: 0 })),
        monthly: Array.from({ length: 12 }, (_, i) => {
          const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - i), 1));
          return { month: d.toISOString().slice(0, 7), amount: 0 };
        }),
        combos: [],
        statuses: new Map(),
        adminGrants: 0,
      });
      return { ...base, ...values.revenue };
    },
    async usage(now, limits: PlanLimitTable) {
      const base = buildUsage({
        month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        limits,
        byPlan: [],
        thresholds: [],
        cost: null,
      });
      return { ...base, ...values.usage };
    },
    async activity(now) {
      return {
        daily: lastDays(now, 30, (date) => ({ date, meetings: 0, hours: 0 })),
        meetingUsers: { dau: 0, wau: 0, mau: 0 },
        ...values.activity,
      };
    },
  };
}
