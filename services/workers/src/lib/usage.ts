import { DEFAULT_PLAN, periodStart, type Plan, type PlanLimitTable } from '@cuelingo/shared';
import type { Sql } from './db';

/** What the stale-sessions job needs from the plan rules: one debrief of the month, or a refusal. */
export interface DebriefAllowance {
  /** True when a debrief may be queued for this user (and one was counted). */
  reserveDebrief(userId: string): Promise<boolean>;
}

/**
 * Same rules and the same atomic upsert as `services/api/src/modules/usage`, over the pure logic in
 * `@cuelingo/shared`. Workers may not import the API, so the SQL is repeated here and kept to one statement.
 */
export function createPostgresDebriefAllowance(
  sql: Sql,
  options: { limits: PlanLimitTable; adminEmails: readonly string[]; now: () => Date },
): DebriefAllowance {
  const admins = new Set(options.adminEmails.map((email) => email.trim().toLowerCase()));

  return {
    async reserveDebrief(userId) {
      // A plan past its `expires_at` counts as free, the same rule as the API (W2-03, AC7).
      const at = options.now();
      const [row] = await sql<{ plan: Plan | null; email: string | null }[]>`
        SELECT (SELECT CASE WHEN expires_at IS NULL OR expires_at > ${at} THEN plan ELSE ${DEFAULT_PLAN} END
            FROM user_plans WHERE user_id = ${userId}) AS plan,
          (SELECT email FROM auth_user WHERE id = ${userId}) AS email`;
      const plan = row?.plan ?? DEFAULT_PLAN;
      const isAdmin = row?.email ? admins.has(row.email.toLowerCase()) : false;
      const limit = isAdmin ? null : options.limits[plan].debriefs;
      const start = periodStart('debriefs', at);

      if (limit === null) {
        await sql`
          INSERT INTO usage_counters (user_id, period_start, metric, amount)
          VALUES (${userId}, ${start}, 'debriefs', 1)
          ON CONFLICT (user_id, period_start, metric)
          DO UPDATE SET amount = usage_counters.amount + EXCLUDED.amount`;
        return true;
      }
      if (limit <= 0) return false;
      const reserved = await sql`
        INSERT INTO usage_counters (user_id, period_start, metric, amount)
        VALUES (${userId}, ${start}, 'debriefs', 1)
        ON CONFLICT (user_id, period_start, metric)
        DO UPDATE SET amount = usage_counters.amount + EXCLUDED.amount
        WHERE usage_counters.amount < ${limit}
        RETURNING amount`;
      return reserved.length > 0;
    },
  };
}
