import {
  DEFAULT_PLAN,
  USAGE_METRICS,
  type Plan,
  type PlanSource,
  type UsageMetric,
} from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

export type PeriodStarts = Record<UsageMetric, Date>;
export type UsageAmounts = Record<UsageMetric, number>;

/** Data access for plans and billing counters. Every method is scoped by user id; counters hold numbers only. */
export interface UsageRepository {
  /**
   * The plan in force at `now` (`free` when none was set or it has expired) and what the user has used in the
   * periods starting at `starts`.
   */
  snapshot(
    userId: string,
    starts: PeriodStarts,
    now: Date,
  ): Promise<{ plan: Plan; amounts: UsageAmounts }>;
  /** The plan and the counter of ONE metric in one round trip: what a gate needs, cheaper than `snapshot`. */
  gate(
    userId: string,
    metric: UsageMetric,
    periodStart: Date,
    now: Date,
  ): Promise<{ plan: Plan; amount: number }>;
  /**
   * Atomically adds `amount` unless the counter already reached `limit`.
   * Returns the new total, or null when refused. The caller rules out `limit <= 0`.
   */
  reserve(
    userId: string,
    metric: UsageMetric,
    periodStart: Date,
    amount: number,
    limit: number,
  ): Promise<number | null>;
  /** Adds `amount` with no cap (time already spent). Returns the new total. */
  add(userId: string, metric: UsageMetric, periodStart: Date, amount: number): Promise<number>;
  /** Admin-set plan (`source = 'manual'`); it never ends unless `expiresAt` is given. */
  setPlan(userId: string, plan: Plan, setBy: string, expiresAt: Date | null): Promise<void>;
  userIdByEmail(email: string): Promise<string | null>;
}

/** SQL for the plan in force at `now`: a plan past its `expires_at` counts as free (AC7). */
const effectivePlanSql = (sql: Sql, now: Date) =>
  sql`CASE WHEN expires_at IS NULL OR expires_at > ${now} THEN plan ELSE ${DEFAULT_PLAN} END`;

export function createPostgresUsageRepository(sql: Sql): UsageRepository {
  return {
    async snapshot(userId, starts, now) {
      const [planRow] = await sql<{ plan: Plan }[]>`
        SELECT ${effectivePlanSql(sql, now)} AS plan FROM user_plans WHERE user_id = ${userId}`;
      const amounts = Object.fromEntries(USAGE_METRICS.map((m) => [m, 0])) as UsageAmounts;
      const earliest = new Date(Math.min(...USAGE_METRICS.map((m) => starts[m].getTime())));
      const rows = await sql<{ metric: UsageMetric; period_start: Date; amount: string }[]>`
        SELECT metric, period_start, amount FROM usage_counters
        WHERE user_id = ${userId} AND period_start >= ${earliest}`;
      for (const row of rows) {
        // Day and month counters share the table, so keep only the row of the metric's own period.
        if (row.period_start.getTime() === starts[row.metric].getTime()) {
          amounts[row.metric] = Number(row.amount);
        }
      }
      return { plan: planRow?.plan ?? DEFAULT_PLAN, amounts };
    },

    async gate(userId, metric, periodStart, now) {
      // One statement by primary key: user_plans (0-1 rows) and the counter of this period (0-1 rows).
      const [row] = await sql<{ plan: Plan | null; amount: string | null }[]>`
        SELECT
          (SELECT ${effectivePlanSql(sql, now)} FROM user_plans WHERE user_id = ${userId}) AS plan,
          (SELECT amount FROM usage_counters
            WHERE user_id = ${userId} AND period_start = ${periodStart} AND metric = ${metric}) AS amount`;
      return { plan: row?.plan ?? DEFAULT_PLAN, amount: Number(row?.amount ?? 0) };
    },

    async reserve(userId, metric, periodStart, amount, limit) {
      const [row] = await sql<{ amount: string }[]>`
        INSERT INTO usage_counters (user_id, period_start, metric, amount)
        VALUES (${userId}, ${periodStart}, ${metric}, ${amount})
        ON CONFLICT (user_id, period_start, metric)
        DO UPDATE SET amount = usage_counters.amount + EXCLUDED.amount
        WHERE usage_counters.amount < ${limit}
        RETURNING amount`;
      return row ? Number(row.amount) : null;
    },

    async add(userId, metric, periodStart, amount) {
      const [row] = await sql<{ amount: string }[]>`
        INSERT INTO usage_counters (user_id, period_start, metric, amount)
        VALUES (${userId}, ${periodStart}, ${metric}, ${amount})
        ON CONFLICT (user_id, period_start, metric)
        DO UPDATE SET amount = usage_counters.amount + EXCLUDED.amount
        RETURNING amount`;
      return Number(row!.amount);
    },

    async setPlan(userId, plan, setBy, expiresAt) {
      await sql`
        INSERT INTO user_plans (user_id, plan, set_by, expires_at, source)
        VALUES (${userId}, ${plan}, ${setBy}, ${expiresAt}, ${'manual' satisfies PlanSource})
        ON CONFLICT (user_id) DO UPDATE SET plan = EXCLUDED.plan, set_by = EXCLUDED.set_by,
          expires_at = EXCLUDED.expires_at, source = EXCLUDED.source, updated_at = now()`;
    },

    async userIdByEmail(email) {
      const [row] = await sql<{ id: string }[]>`
        SELECT id FROM auth_user WHERE lower(email) = lower(${email})`;
      return row?.id ?? null;
    },
  };
}
