import { describe, expect, it } from 'vitest';
import {
  AdminAccessSchema,
  AdminActivitySchema,
  AdminOverviewSchema,
  AdminRevenueSchema,
  AdminUsageSchema,
} from './admin-analytics.dto';
import { AdminUserListQuerySchema } from './admin-users.dto';

const at = '2026-11-16T00:00:00.000Z';
const days = (n: number, extra: object) =>
  Array.from({ length: n }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    ...extra,
  }));

describe('admin analytics contract', () => {
  it('accepts an overview and refuses an identifier', () => {
    const overview = {
      generatedAt: at,
      totalUsers: 3,
      newUsers: { d7: 1, d30: 2 },
      activeUsers: { d1: 0, d7: 1, d30: 2 },
      byPlan: { free: 1, pro: 1, ultra: 1 },
      revenueThisMonth: 0,
      expiringIn7d: 0,
      daily: days(30, { newUsers: 0, activeUsers: 0 }),
    };
    expect(AdminOverviewSchema.safeParse(overview).success).toBe(true);
    expect(AdminOverviewSchema.safeParse({ ...overview, email: 'a@b.c' }).success).toBe(false);
    expect(
      AdminOverviewSchema.safeParse({ ...overview, daily: overview.daily.slice(1) }).success,
    ).toBe(false);
  });

  it('accepts revenue with a null paid rate and needs all four plan-period pairs', () => {
    const pairs = (['pro', 'ultra'] as const).flatMap((plan) =>
      (['month', 'year'] as const).map((period) => ({ plan, period, orders: 0, amount: 0 })),
    );
    const revenue = {
      generatedAt: at,
      daily: days(30, { amount: 0 }),
      monthly: Array.from({ length: 12 }, (_, i) => ({
        month: `2026-${String(i + 1).padStart(2, '0')}`,
        amount: 0,
      })),
      byPlanPeriod: pairs,
      ordersByStatus: { pending: 0, paid: 0, expired: 0, cancelled: 0 },
      paidRate: null,
      adminGrants: 0,
    };
    expect(AdminRevenueSchema.safeParse(revenue).success).toBe(true);
    expect(AdminRevenueSchema.safeParse({ ...revenue, byPlanPeriod: pairs.slice(1) }).success).toBe(
      false,
    );
  });

  it('accepts usage with null thresholds', () => {
    const metric = (m: string) => ({
      metric: m,
      total: 0,
      averageByPlan: { free: null, pro: null, ultra: null },
      atLeast80: null,
      atLeast100: null,
    });
    const usage = {
      generatedAt: at,
      periodStart: at,
      metrics: ['translation_ms', 'cloud_stt_ms', 'debriefs', 'agent_messages'].map(metric),
      aiCostUsdThisMonth: null,
    };
    expect(AdminUsageSchema.safeParse(usage).success).toBe(true);
    expect(
      AdminUsageSchema.safeParse({ ...usage, metrics: [metric('assist_daily')] }).success,
    ).toBe(false);
  });

  it('wraps the existing metrics in activity', () => {
    expect(AdminActivitySchema.safeParse({ generatedAt: at }).success).toBe(false);
  });

  it('answers access with one boolean', () => {
    expect(AdminAccessSchema.parse({ isAdmin: false })).toEqual({ isAdmin: false });
    expect(AdminAccessSchema.safeParse({ isAdmin: true, email: 'x' }).success).toBe(false);
  });

  it('needs metric and atLeast together on the user list query', () => {
    expect(AdminUserListQuerySchema.safeParse({ metric: 'debriefs', atLeast: '80' }).success).toBe(
      true,
    );
    expect(AdminUserListQuerySchema.safeParse({ metric: 'debriefs' }).success).toBe(false);
    expect(AdminUserListQuerySchema.safeParse({ atLeast: '100' }).success).toBe(false);
    expect(
      AdminUserListQuerySchema.safeParse({ metric: 'assist_daily', atLeast: '80' }).success,
    ).toBe(false);
  });
});
