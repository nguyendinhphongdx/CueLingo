import {
  periodEnd,
  periodStart,
  type AdminDashboard,
  type AdminUserRow,
  type Plan,
  type PlanSource,
} from '@cuelingo/shared';
import type postgres from 'postgres';
import type { Sql } from '../../lib/db';

/** Where the next page starts. `createdAt` is the database's own text, because a JS Date cuts microseconds. */
export interface UserCursor {
  createdAt: string;
  id: string;
}

export interface UserFilter {
  /** Raw text; the repository escapes it. */
  q?: string;
  /** The plan in force. */
  plan?: Plan;
  /** Pro/Ultra ending within 7 days. */
  expiring?: boolean;
  after?: UserCursor;
}

export interface UserPage {
  items: AdminUserRow[];
  /** Set when there are more rows after `items`. */
  next: UserCursor | null;
}

export const EXPIRING_DAYS = 7;
const DAY_MS = 86_400_000;

/**
 * Cross-user reads for the admin screen. They are reachable only after the service has checked `ADMIN_EMAILS`,
 * and select no meeting content: sessions contribute one timestamp, orders one sum.
 */
export interface AdminUsersRepository {
  dashboard(now: Date): Promise<AdminDashboard>;
  list(filter: UserFilter, now: Date, limit: number): Promise<UserPage>;
  find(id: string, now: Date): Promise<AdminUserRow | null>;
}

interface RowDb {
  id: string;
  email: string;
  name: string;
  created_at: Date;
  created_key: string;
  plan: Plan;
  source: PlanSource | null;
  expires_at: Date | null;
  translation_ms: string;
  last_active_at: Date | null;
}

const toRow = (r: RowDb): AdminUserRow => ({
  id: r.id,
  email: r.email,
  name: r.name,
  createdAt: r.created_at.toISOString(),
  plan: r.plan,
  source: r.source,
  expiresAt: r.expires_at?.toISOString() ?? null,
  translationMsThisMonth: Number(r.translation_ms),
  lastActiveAt: r.last_active_at?.toISOString() ?? null,
});

/** Makes `%`, `_` and `\` in what the admin typed match themselves in ILIKE (backslash is its default escape). */
export const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

export function createPostgresAdminUsersRepository(sql: Sql): AdminUsersRepository {
  /**
   * "In force" mirrors `effectivePlanSql` in `usage.repository.ts`: no row, or a row past `expires_at`, is free.
   * An int test compares the two so they cannot drift apart.
   */
  const live = (now: Date) => sql`(up.expires_at IS NULL OR up.expires_at > ${now})`;

  async function select(where: postgres.PendingQuery<postgres.Row[]>, now: Date, limit: number) {
    const month = periodStart('translation_ms', now);
    return sql<RowDb[]>`
      WITH page AS (
        SELECT u.id, u.email, u.name, u."createdAt" AS created_at,
          to_char(u."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_key,
          CASE WHEN up.plan IS NOT NULL AND ${live(now)} THEN up.plan ELSE 'free' END AS plan,
          up.source, up.expires_at
        FROM auth_user u LEFT JOIN user_plans up ON up.user_id = u.id
        WHERE ${where}
        ORDER BY u."createdAt" DESC, u.id DESC
        LIMIT ${limit}
      )
      SELECT page.*,
        COALESCE((SELECT c.amount FROM usage_counters c
          WHERE c.user_id = page.id AND c.metric = 'translation_ms' AND c.period_start = ${month}), 0) AS translation_ms,
        (SELECT max(s.started_at) FROM sessions s
          WHERE s.user_id = page.id AND s.status <> 'deleted') AS last_active_at
      FROM page
      ORDER BY page.created_at DESC, page.id DESC`;
  }

  return {
    async dashboard(now) {
      const monthStart = periodStart('translation_ms', now);
      const monthEnd = periodEnd('translation_ms', now);
      const week = new Date(now.getTime() - EXPIRING_DAYS * DAY_MS);
      const soon = new Date(now.getTime() + EXPIRING_DAYS * DAY_MS);
      const [row] = await sql<
        {
          total: number;
          pro: number;
          ultra: number;
          new_7d: number;
          expiring: number;
          revenue: string;
        }[]
      >`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE up.plan = 'pro' AND ${live(now)})::int AS pro,
          count(*) FILTER (WHERE up.plan = 'ultra' AND ${live(now)})::int AS ultra,
          count(*) FILTER (WHERE u."createdAt" >= ${week})::int AS new_7d,
          count(*) FILTER (WHERE up.plan IN ('pro', 'ultra')
            AND up.expires_at > ${now} AND up.expires_at <= ${soon})::int AS expiring,
          (SELECT COALESCE(sum(amount), 0) FROM billing_orders
            WHERE status = 'paid' AND paid_at >= ${monthStart} AND paid_at < ${monthEnd})::text AS revenue
        FROM auth_user u LEFT JOIN user_plans up ON up.user_id = u.id`;
      const total = row?.total ?? 0;
      const pro = row?.pro ?? 0;
      const ultra = row?.ultra ?? 0;
      return {
        generatedAt: now.toISOString(),
        totalUsers: total,
        byPlan: { free: total - pro - ultra, pro, ultra },
        newUsers7d: row?.new_7d ?? 0,
        revenueThisMonth: Number(row?.revenue ?? 0),
        expiringIn7d: row?.expiring ?? 0,
      };
    },

    async list(filter, now, limit) {
      const conditions = [sql`TRUE`];
      if (filter.q) {
        const pattern = `%${escapeLike(filter.q)}%`;
        conditions.push(sql`(u.email ILIKE ${pattern} OR u.name ILIKE ${pattern})`);
      }
      if (filter.plan === 'free') {
        conditions.push(sql`(up.plan IS NULL OR up.plan = 'free' OR NOT ${live(now)})`);
      } else if (filter.plan) {
        conditions.push(sql`(up.plan = ${filter.plan} AND ${live(now)})`);
      }
      if (filter.expiring) {
        const soon = new Date(now.getTime() + EXPIRING_DAYS * DAY_MS);
        conditions.push(
          sql`(up.plan IN ('pro', 'ultra') AND up.expires_at > ${now} AND up.expires_at <= ${soon})`,
        );
      }
      if (filter.after) {
        conditions.push(
          sql`(u."createdAt", u.id) < (${filter.after.createdAt}::timestamptz, ${filter.after.id}::uuid)`,
        );
      }
      const where = conditions.reduce((all, one) => sql`${all} AND ${one}`);
      // One extra row tells whether another page exists.
      const rows = await select(where, now, limit + 1);
      const page = rows.slice(0, limit);
      const last = page[page.length - 1];
      return {
        items: page.map(toRow),
        next: rows.length > limit && last ? { createdAt: last.created_key, id: last.id } : null,
      };
    },

    async find(id, now) {
      const [row] = await select(sql`u.id = ${id}`, now, 1);
      return row ? toRow(row) : null;
    },
  };
}
