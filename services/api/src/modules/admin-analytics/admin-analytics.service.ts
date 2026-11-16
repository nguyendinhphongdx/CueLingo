import {
  AdminActivitySchema,
  AdminOverviewSchema,
  AdminRevenueSchema,
  AdminUsageSchema,
  ErrorCode,
  type AdminActivity,
  type AdminDashboard,
  type AdminMetrics,
  type AdminOverview,
  type AdminRevenue,
  type AdminUsage,
  type PlanLimitTable,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { AdminAnalyticsRepository } from './admin-analytics.repository';

export type AdminAnalyticsService = ReturnType<typeof createAdminAnalyticsService>;

export interface AdminAnalyticsOptions {
  isAdmin: (userId: string) => Promise<boolean>;
  /** The limits of the deploy (env `PLAN_LIMITS`). */
  limits: PlanLimitTable;
  /** Existing numbers, reused through the gates of their own modules (each checks the admin again). */
  dashboard: (adminId: string) => Promise<AdminDashboard>;
  metrics: (adminId: string) => Promise<AdminMetrics>;
  now?: () => Date;
  /** How long an answer is reused. Default 60 s (spec Q6). */
  cacheMs?: number;
}

type Key = 'overview' | 'revenue' | 'usage' | 'activity';

/**
 * Statistics for the admin console. Every method checks `ADMIN_EMAILS` first, before the cache, so a stranger
 * never reads a cached answer. The answers hold no per-person data, so one cache entry serves every admin.
 * The entry holds the promise: callers at the same time share one run of the SQL; a failure drops the entry.
 */
export function createAdminAnalyticsService(
  repo: AdminAnalyticsRepository,
  options: AdminAnalyticsOptions,
) {
  const now = options.now ?? (() => new Date());
  const cacheMs = options.cacheMs ?? 60_000;
  const cache = new Map<Key, { at: number; promise: Promise<unknown> }>();

  async function requireAdmin(userId: string): Promise<void> {
    if (!(await options.isAdmin(userId))) {
      throw new AppError(ErrorCode.Forbidden, 'Admin access required');
    }
  }

  async function cached<T>(
    userId: string,
    key: Key,
    compute: (at: Date) => Promise<T>,
  ): Promise<T> {
    await requireAdmin(userId);
    const at = now();
    const hit = cache.get(key);
    if (hit && at.getTime() - hit.at < cacheMs) return hit.promise as Promise<T>;
    const promise = compute(at);
    const entry = { at: at.getTime(), promise };
    cache.set(key, entry);
    promise.catch(() => {
      if (cache.get(key) === entry) cache.delete(key);
    });
    return promise;
  }

  return {
    overview: (adminId: string): Promise<AdminOverview> =>
      cached(adminId, 'overview', async (at) => {
        const [dashboard, part] = await Promise.all([
          options.dashboard(adminId),
          repo.overview(at),
        ]);
        return AdminOverviewSchema.parse({
          generatedAt: at.toISOString(),
          totalUsers: dashboard.totalUsers,
          byPlan: dashboard.byPlan,
          revenueThisMonth: dashboard.revenueThisMonth,
          expiringIn7d: dashboard.expiringIn7d,
          ...part,
        });
      }),
    revenue: (adminId: string): Promise<AdminRevenue> =>
      cached(adminId, 'revenue', async (at) =>
        AdminRevenueSchema.parse({ generatedAt: at.toISOString(), ...(await repo.revenue(at)) }),
      ),
    usage: (adminId: string): Promise<AdminUsage> =>
      cached(adminId, 'usage', async (at) =>
        AdminUsageSchema.parse({
          generatedAt: at.toISOString(),
          ...(await repo.usage(at, options.limits)),
        }),
      ),
    activity: (adminId: string): Promise<AdminActivity> =>
      cached(adminId, 'activity', async (at) => {
        const [metrics, part] = await Promise.all([options.metrics(adminId), repo.activity(at)]);
        return AdminActivitySchema.parse({ generatedAt: at.toISOString(), metrics, ...part });
      }),
  };
}
