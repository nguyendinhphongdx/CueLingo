import { z } from 'zod';
import { BillingPeriodSchema, PaidPlanSchema } from '../billing';
import { AdminMetricsSchema } from './admin.dto';
import { BillingOrderStatusSchema } from './billing.dto';

/**
 * Admin console statistics. Aggregates only: no email, no user id, no meeting content. The one screen that names
 * people is the user list (`admin-users.dto.ts`). Every shape carries `generatedAt` because the API caches them.
 */

const Count = z.number().int().min(0);
const Dong = z.number().int().min(0);

/** `GET /v1/admin/me`: tells the caller whether it is on the admin allowlist. Never `403`. */
export const AdminAccessSchema = z.object({ isAdmin: z.boolean() }).strict();
export type AdminAccess = z.infer<typeof AdminAccessSchema>;

export const AdminDayCountSchema = z
  .object({ date: z.iso.date(), newUsers: Count, activeUsers: Count })
  .strict();

/** `GET /v1/admin/analytics/overview`. A person is active on a day with a meeting or a review session. */
export const AdminOverviewSchema = z
  .object({
    generatedAt: z.iso.datetime(),
    totalUsers: Count,
    newUsers: z.object({ d7: Count, d30: Count }).strict(),
    activeUsers: z.object({ d1: Count, d7: Count, d30: Count }).strict(),
    /** Plans in force now. */
    byPlan: z.object({ free: Count, pro: Count, ultra: Count }).strict(),
    revenueThisMonth: Dong,
    expiringIn7d: Count,
    /** Last 30 calendar days, Vietnam time, oldest first. */
    daily: z.array(AdminDayCountSchema).length(30),
  })
  .strict();
export type AdminOverview = z.infer<typeof AdminOverviewSchema>;

/** `GET /v1/admin/analytics/revenue`. Revenue is paid orders only; admin grants (0 dong) are counted apart. */
export const AdminRevenueSchema = z
  .object({
    generatedAt: z.iso.datetime(),
    daily: z.array(z.object({ date: z.iso.date(), amount: Dong }).strict()).length(30),
    monthly: z
      .array(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), amount: Dong }).strict())
      .length(12),
    /** All 4 plan-period pairs, last 30 days; a pair with no sale is 0. */
    byPlanPeriod: z
      .array(
        z
          .object({
            plan: PaidPlanSchema,
            period: BillingPeriodSchema,
            orders: Count,
            amount: Dong,
          })
          .strict(),
      )
      .length(4),
    /** Orders created in the last 30 days, admin grants excluded. */
    ordersByStatus: z.record(BillingOrderStatusSchema, Count),
    /** `paid` / all orders created; `null` when there are none. */
    paidRate: z.number().min(0).max(1).nullable(),
    adminGrants: Count,
  })
  .strict();
export type AdminRevenue = z.infer<typeof AdminRevenueSchema>;

export const AdminUsageMetricSchema = z.enum([
  'translation_ms',
  'cloud_stt_ms',
  'debriefs',
  'agent_messages',
]);
export type AdminUsageMetric = z.infer<typeof AdminUsageMetricSchema>;

export const AdminUsageMetricStatsSchema = z
  .object({
    metric: AdminUsageMetricSchema,
    /** Everyone, this month (Vietnam time). Milliseconds for the two time metrics, a count otherwise. */
    total: z.number().min(0),
    /** Mean per person on that plan; `null` when nobody is on it. */
    averageByPlan: z
      .object({
        free: z.number().min(0).nullable(),
        pro: z.number().min(0).nullable(),
        ultra: z.number().min(0).nullable(),
      })
      .strict(),
    /** People at or above 80% / 100% of their limit; `null` when no plan has a limit for this metric. */
    atLeast80: Count.nullable(),
    atLeast100: Count.nullable(),
  })
  .strict();

/** `GET /v1/admin/analytics/usage`. */
export const AdminUsageSchema = z
  .object({
    generatedAt: z.iso.datetime(),
    periodStart: z.iso.datetime(),
    metrics: z.array(AdminUsageMetricStatsSchema).length(4),
    aiCostUsdThisMonth: z.number().min(0).nullable(),
  })
  .strict();
export type AdminUsage = z.infer<typeof AdminUsageSchema>;

/** `GET /v1/admin/analytics/activity`. `metrics` is exactly what `GET /v1/admin/metrics` answers. */
export const AdminActivitySchema = z
  .object({
    generatedAt: z.iso.datetime(),
    metrics: AdminMetricsSchema,
    daily: z
      .array(z.object({ date: z.iso.date(), meetings: Count, hours: z.number().min(0) }).strict())
      .length(30),
    /** People with a meeting in the last 1, 7, 30 days. */
    meetingUsers: z.object({ dau: Count, wau: Count, mau: Count }).strict(),
  })
  .strict();
export type AdminActivity = z.infer<typeof AdminActivitySchema>;
