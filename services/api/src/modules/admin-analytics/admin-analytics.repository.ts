import {
  periodStart,
  type AdminActivity,
  type AdminOverview,
  type AdminRevenue,
  type AdminUsage,
  type AdminUsageMetric,
  type BillingOrderStatus,
  type PlanLimitTable,
} from '@cuelingo/shared';
import type { Sql } from '../../lib/db';
import { limitsTable, livePlanSql } from '../../lib/plan-sql';

/** What the repository adds to the shapes the service assembles (`generatedAt` and the ports come from there). */
export type OverviewPart = Pick<AdminOverview, 'newUsers' | 'activeUsers' | 'daily'>;
export type RevenuePart = Omit<AdminRevenue, 'generatedAt'>;
export type UsagePart = Omit<AdminUsage, 'generatedAt'>;
export type ActivityPart = Pick<AdminActivity, 'daily' | 'meetingUsers'>;

/**
 * Cross-user aggregates for the admin console. Reachable only after the service has checked `ADMIN_EMAILS`.
 * Nothing here selects an email, a name, an id or meeting content: ids are used inside `count(DISTINCT …)` only.
 * Days and months are calendar days and months in Vietnam time; N-day windows slide back from `now`.
 */
export interface AdminAnalyticsRepository {
  overview(now: Date): Promise<OverviewPart>;
  revenue(now: Date): Promise<RevenuePart>;
  usage(now: Date, limits: PlanLimitTable): Promise<UsagePart>;
  activity(now: Date): Promise<ActivityPart>;
}

export const USAGE_METRICS_SHOWN: readonly AdminUsageMetric[] = [
  'translation_ms',
  'cloud_stt_ms',
  'debriefs',
  'agent_messages',
];
const STATUSES: readonly BillingOrderStatus[] = ['pending', 'paid', 'expired', 'cancelled'];
const PAID_COMBOS = [
  { plan: 'pro', period: 'month' },
  { plan: 'pro', period: 'year' },
  { plan: 'ultra', period: 'month' },
  { plan: 'ultra', period: 'year' },
] as const;

export function createPostgresAdminAnalyticsRepository(sql: Sql): AdminAnalyticsRepository {
  /** The calendar day of Vietnam time, as a `date`. */
  const today = (now: Date) => sql`(${now}::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
  const day = (column: ReturnType<typeof sql>) =>
    sql`(${column} AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
  const text = (column: ReturnType<typeof sql>) => sql`to_char(${column}, 'YYYY-MM-DD')`;

  return {
    async overview(now) {
      // Both windows start at the Vietnam midnight 30 days back, so a 30-day sliding window and 30 calendar days fit.
      const since = sql`((${today(now)} - 30)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
      const [summary] = await sql<
        { n7: number; n30: number; a1: number; a7: number; a30: number }[]
      >`
        WITH act AS (
          SELECT user_id, started_at AS at FROM sessions
            WHERE status <> 'deleted' AND started_at >= ${since}
          UNION ALL
          SELECT user_id, at FROM review_logs WHERE at >= ${since}
        )
        SELECT
          (SELECT count(*) FROM auth_user WHERE "createdAt" >= ${now}::timestamptz - interval '7 days')::int AS n7,
          (SELECT count(*) FROM auth_user WHERE "createdAt" >= ${now}::timestamptz - interval '30 days')::int AS n30,
          (SELECT count(DISTINCT user_id) FROM act WHERE at >= ${now}::timestamptz - interval '1 day')::int AS a1,
          (SELECT count(DISTINCT user_id) FROM act WHERE at >= ${now}::timestamptz - interval '7 days')::int AS a7,
          (SELECT count(DISTINCT user_id) FROM act WHERE at >= ${now}::timestamptz - interval '30 days')::int AS a30`;
      const daily = await sql<{ date: string; new_users: number; active_users: number }[]>`
        WITH days AS (SELECT generate_series(${today(now)} - 29, ${today(now)}, interval '1 day')::date AS d),
        created AS (
          SELECT ${day(sql`"createdAt"`)} AS d, count(*)::int AS n FROM auth_user
          WHERE "createdAt" >= ${since} GROUP BY 1),
        act AS (
          SELECT ${day(sql`at`)} AS d, count(DISTINCT user_id)::int AS n FROM (
            SELECT user_id, started_at AS at FROM sessions WHERE status <> 'deleted' AND started_at >= ${since}
            UNION ALL SELECT user_id, at FROM review_logs WHERE at >= ${since}) x
          GROUP BY 1)
        SELECT ${text(sql`days.d`)} AS date, COALESCE(created.n, 0) AS new_users, COALESCE(act.n, 0) AS active_users
        FROM days LEFT JOIN created ON created.d = days.d LEFT JOIN act ON act.d = days.d
        ORDER BY days.d`;
      return {
        newUsers: { d7: summary?.n7 ?? 0, d30: summary?.n30 ?? 0 },
        activeUsers: { d1: summary?.a1 ?? 0, d7: summary?.a7 ?? 0, d30: summary?.a30 ?? 0 },
        daily: daily.map((r) => ({
          date: r.date,
          newUsers: r.new_users,
          activeUsers: r.active_users,
        })),
      };
    },

    async revenue(now) {
      const since30 = sql`${now}::timestamptz - interval '30 days'`;
      const paid = sql`status = 'paid' AND provider <> 'admin'`;
      const [daily, monthly, combos, statuses, grants] = await Promise.all([
        sql<{ date: string; amount: string }[]>`
          WITH days AS (SELECT generate_series(${today(now)} - 29, ${today(now)}, interval '1 day')::date AS d)
          SELECT ${text(sql`days.d`)} AS date, COALESCE(sum(o.amount), 0)::text AS amount
          FROM days LEFT JOIN billing_orders o ON ${paid} AND ${day(sql`o.paid_at`)} = days.d
          GROUP BY days.d ORDER BY days.d`,
        sql<{ month: string; amount: string }[]>`
          WITH months AS (
            SELECT generate_series(date_trunc('month', ${today(now)}::timestamp) - interval '11 months',
              date_trunc('month', ${today(now)}::timestamp), interval '1 month') AS m)
          SELECT to_char(months.m, 'YYYY-MM') AS month, COALESCE(sum(o.amount), 0)::text AS amount
          FROM months LEFT JOIN billing_orders o ON ${paid}
            AND date_trunc('month', o.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = months.m
          GROUP BY months.m ORDER BY months.m`,
        sql<{ plan: string; period: string; orders: number; amount: string }[]>`
          SELECT plan, period, count(*)::int AS orders, COALESCE(sum(amount), 0)::text AS amount
          FROM billing_orders WHERE ${paid} AND paid_at >= ${since30} GROUP BY plan, period`,
        sql<{ status: BillingOrderStatus; n: number }[]>`
          SELECT status, count(*)::int AS n FROM billing_orders
          WHERE provider <> 'admin' AND created_at >= ${since30} GROUP BY status`,
        sql<{ n: number }[]>`
          SELECT count(*)::int AS n FROM billing_orders WHERE provider = 'admin' AND created_at >= ${since30}`,
      ]);
      return buildRevenue({
        daily: daily.map((r) => ({ date: r.date, amount: Number(r.amount) })),
        monthly: monthly.map((r) => ({ month: r.month, amount: Number(r.amount) })),
        combos: combos.map((r) => ({
          plan: r.plan,
          period: r.period,
          orders: r.orders,
          amount: Number(r.amount),
        })),
        statuses: new Map(statuses.map((r) => [r.status, r.n])),
        adminGrants: grants[0]?.n ?? 0,
      });
    },

    async usage(now, limits) {
      const month = periodStart('translation_ms', now);
      const shown = sql`(VALUES ('translation_ms'), ('cloud_stt_ms'), ('debriefs'), ('agent_messages')) AS m(metric)`;
      const people = sql`(SELECT u.id, ${livePlanSql(sql, now)} AS plan
        FROM auth_user u LEFT JOIN user_plans up ON up.user_id = u.id) p`;
      const table = limitsTable(sql, limits, USAGE_METRICS_SHOWN);
      const [byPlan, thresholds, cost] = await Promise.all([
        sql<{ plan: string; metric: AdminUsageMetric; people: number; total: string }[]>`
          SELECT p.plan, m.metric, count(*)::int AS people, COALESCE(sum(c.amount), 0)::text AS total
          FROM ${people} CROSS JOIN ${shown}
          LEFT JOIN usage_counters c ON c.user_id = p.id AND c.metric = m.metric AND c.period_start = ${month}
          GROUP BY p.plan, m.metric`,
        table
          ? sql<{ metric: AdminUsageMetric; at80: number; at100: number }[]>`
              SELECT l.metric,
                count(*) FILTER (WHERE c.amount * 100 >= 80 * l.lim)::int AS at80,
                count(*) FILTER (WHERE c.amount >= l.lim)::int AS at100
              FROM ${people} JOIN ${table} ON l.plan = p.plan
              JOIN usage_counters c ON c.user_id = p.id AND c.metric = l.metric AND c.period_start = ${month}
              GROUP BY l.metric`
          : Promise.resolve([]),
        // Only the cost column is read, never the payload.
        sql<{ cost: number | null }[]>`
          SELECT sum(cost_usd)::float AS cost FROM events
          WHERE type = 'ai_call' AND at >= ${month} AND cost_usd IS NOT NULL`,
      ]);
      return buildUsage({
        month,
        limits,
        byPlan: byPlan.map((r) => ({ ...r, total: Number(r.total) })),
        thresholds,
        cost: cost[0]?.cost ?? null,
      });
    },

    async activity(now) {
      const [daily, users] = await Promise.all([
        sql<{ date: string; meetings: number; hours: number }[]>`
          WITH days AS (SELECT generate_series(${today(now)} - 29, ${today(now)}, interval '1 day')::date AS d)
          SELECT ${text(sql`days.d`)} AS date, count(s.id)::int AS meetings,
            COALESCE(sum(EXTRACT(epoch FROM (s.ended_at - s.started_at))) FILTER (WHERE s.ended_at IS NOT NULL), 0)::float / 3600 AS hours
          FROM days LEFT JOIN sessions s ON s.status <> 'deleted' AND ${day(sql`s.started_at`)} = days.d
          GROUP BY days.d ORDER BY days.d`,
        sql<{ dau: number; wau: number; mau: number }[]>`
          SELECT
            count(DISTINCT user_id) FILTER (WHERE started_at >= ${now}::timestamptz - interval '1 day')::int AS dau,
            count(DISTINCT user_id) FILTER (WHERE started_at >= ${now}::timestamptz - interval '7 days')::int AS wau,
            count(DISTINCT user_id) FILTER (WHERE started_at >= ${now}::timestamptz - interval '30 days')::int AS mau
          FROM sessions WHERE status <> 'deleted' AND started_at >= ${now}::timestamptz - interval '30 days'`,
      ]);
      return {
        daily: daily.map((r) => ({ date: r.date, meetings: r.meetings, hours: r.hours })),
        meetingUsers: { dau: users[0]?.dau ?? 0, wau: users[0]?.wau ?? 0, mau: users[0]?.mau ?? 0 },
      };
    },
  };
}

/** Pure part of the revenue answer: fills the 4 plan-period pairs and the 4 statuses, and works out the rate. */
export function buildRevenue(input: {
  daily: RevenuePart['daily'];
  monthly: RevenuePart['monthly'];
  combos: Array<{ plan: string; period: string; orders: number; amount: number }>;
  statuses: Map<BillingOrderStatus, number>;
  adminGrants: number;
}): RevenuePart {
  const ordersByStatus = Object.fromEntries(
    STATUSES.map((s) => [s, input.statuses.get(s) ?? 0]),
  ) as Record<BillingOrderStatus, number>;
  const created = STATUSES.reduce((sum, s) => sum + ordersByStatus[s], 0);
  return {
    daily: input.daily,
    monthly: input.monthly,
    byPlanPeriod: PAID_COMBOS.map((c) => {
      const found = input.combos.find((x) => x.plan === c.plan && x.period === c.period);
      return { ...c, orders: found?.orders ?? 0, amount: found?.amount ?? 0 };
    }),
    ordersByStatus,
    paidRate: created === 0 ? null : ordersByStatus.paid / created,
    adminGrants: input.adminGrants,
  };
}

/** Pure part of the usage answer. A metric no plan limits has `null` thresholds, a plan with nobody has a `null` mean. */
export function buildUsage(input: {
  month: Date;
  limits: PlanLimitTable;
  byPlan: Array<{ plan: string; metric: AdminUsageMetric; people: number; total: number }>;
  thresholds: Array<{ metric: AdminUsageMetric; at80: number; at100: number }>;
  cost: number | null;
}): UsagePart {
  return {
    periodStart: input.month.toISOString(),
    metrics: USAGE_METRICS_SHOWN.map((metric) => {
      const rows = input.byPlan.filter((r) => r.metric === metric);
      const mean = (plan: string) => {
        const row = rows.find((r) => r.plan === plan);
        return row && row.people > 0 ? row.total / row.people : null;
      };
      const limited = (['free', 'pro', 'ultra'] as const).some((p) => {
        const lim = input.limits[p][metric];
        return lim !== null && lim > 0;
      });
      const hit = input.thresholds.find((t) => t.metric === metric);
      return {
        metric,
        total: rows.reduce((sum, r) => sum + r.total, 0),
        averageByPlan: { free: mean('free'), pro: mean('pro'), ultra: mean('ultra') },
        atLeast80: limited ? (hit?.at80 ?? 0) : null,
        atLeast100: limited ? (hit?.at100 ?? 0) : null,
      };
    }),
    aiCostUsdThisMonth: input.cost,
  };
}
