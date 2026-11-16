import { PlanSchema, type Plan, type PlanLimitTable, type UsageMetric } from '@cuelingo/shared';
import type { Sql } from './db';

/**
 * SQL pieces the admin statistics share. Only new code uses this file; `usage.repository.ts` and the older
 * admin-users queries keep their own copy of the "plan in force" rule on purpose (no refactor on the side).
 * Int tests compare the results with `usage.service.snapshot` so the copies cannot drift apart.
 */

/** The plan in force for a row of `user_plans` aliased `up` (may be NULL by a LEFT JOIN): no row or a past end is free. */
export const livePlanSql = (sql: Sql, now: Date) =>
  sql`CASE WHEN up.plan IS NOT NULL AND (up.expires_at IS NULL OR up.expires_at > ${now}) THEN up.plan ELSE 'free' END`;

/**
 * `(VALUES …) AS alias(plan, metric, lim)` for the metrics asked, left out when a plan has no limit (`null`)
 * or a limit of 0 (nothing to be "at 80% of"). Returns `null` when no pair is left.
 */
export function limitsTable(
  sql: Sql,
  limits: PlanLimitTable,
  metrics: readonly UsageMetric[],
  alias = 'l',
) {
  const rows: Array<{ plan: Plan; metric: UsageMetric; lim: number }> = [];
  for (const plan of PlanSchema.options) {
    for (const metric of metrics) {
      const lim = limits[plan][metric];
      if (lim !== null && lim > 0) rows.push({ plan, metric, lim });
    }
  }
  if (rows.length === 0) return null;
  const values = rows
    .map((r) => sql`(${r.plan}::text, ${r.metric}::text, ${r.lim}::bigint)`)
    .reduce((all, one) => sql`${all}, ${one}`);
  return sql`(VALUES ${values}) AS ${sql(alias)}(plan, metric, lim)`;
}
