import type { AdminMetrics } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

export interface AdminRepository {
  emailForUser(userId: string): Promise<string | null>;
  metrics(now: Date): Promise<AdminMetrics>;
}

interface SummaryRow {
  active_users_7d: number;
  meetings_7d: number;
  meeting_hours_7d: number;
  meetings_30d: number;
  meeting_hours_30d: number;
  debrief_median_minutes: number | null;
  debrief_p95_minutes: number | null;
  ai_cost_per_meeting_hour_usd: number | null;
  debrief_success_rate: number | null;
}

interface ReviewDayRow {
  date: string;
  count: number;
}

/** Aggregate queries intentionally cross user boundaries, and are only reachable after admin authorization. */
export function createPostgresAdminRepository(sql: Sql): AdminRepository {
  return {
    async emailForUser(userId) {
      const [row] = await sql<{ email: string }[]>`
        SELECT email FROM auth_user WHERE id = ${userId}`;
      return row?.email ?? null;
    },

    async metrics(now) {
      const [summary] = await sql<SummaryRow[]>`
        WITH activity AS (
          SELECT user_id, started_at AS at FROM sessions
          UNION ALL SELECT user_id, at FROM events
          UNION ALL SELECT user_id, at FROM review_logs
        ),
        meeting_stats AS (
          SELECT
            count(*) FILTER (WHERE started_at >= ${now} - interval '7 days')::integer AS meetings_7d,
            COALESCE(sum(EXTRACT(epoch FROM (ended_at - started_at)))
              FILTER (WHERE started_at >= ${now} - interval '7 days' AND ended_at IS NOT NULL), 0)::float / 3600 AS meeting_hours_7d,
            count(*) FILTER (WHERE started_at >= ${now} - interval '30 days')::integer AS meetings_30d,
            COALESCE(sum(EXTRACT(epoch FROM (ended_at - started_at)))
              FILTER (WHERE started_at >= ${now} - interval '30 days' AND ended_at IS NOT NULL), 0)::float / 3600 AS meeting_hours_30d,
            COALESCE(sum(cost_usd) FILTER (WHERE started_at >= ${now} - interval '30 days'), 0)::float AS cost_30d,
            count(*) FILTER (WHERE started_at >= ${now} - interval '30 days' AND ended_at IS NOT NULL)::integer AS ended_30d
          FROM sessions WHERE status <> 'deleted'
        ),
        first_debrief AS (
          SELECT sessions.id, sessions.ended_at, min(debriefs.created_at) AS created_at
          FROM sessions LEFT JOIN debriefs ON debriefs.session_id = sessions.id
          WHERE sessions.status <> 'deleted' AND sessions.ended_at IS NOT NULL
            AND sessions.started_at >= ${now} - interval '30 days'
          GROUP BY sessions.id, sessions.ended_at
        ),
        debrief_stats AS (
          SELECT
            percentile_cont(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(epoch FROM (created_at - ended_at)) / 60
            )::float AS median_minutes,
            percentile_cont(0.95) WITHIN GROUP (
              ORDER BY EXTRACT(epoch FROM (created_at - ended_at)) / 60
            )::float AS p95_minutes,
            count(*) FILTER (WHERE created_at IS NOT NULL)::float AS succeeded
          FROM first_debrief
        )
        SELECT
          (SELECT count(DISTINCT user_id)::integer FROM activity
            WHERE at >= ${now} - interval '7 days') AS active_users_7d,
          meeting_stats.meetings_7d,
          meeting_stats.meeting_hours_7d,
          meeting_stats.meetings_30d,
          meeting_stats.meeting_hours_30d,
          debrief_stats.median_minutes AS debrief_median_minutes,
          debrief_stats.p95_minutes AS debrief_p95_minutes,
          CASE WHEN meeting_stats.meeting_hours_30d > 0
            THEN meeting_stats.cost_30d / meeting_stats.meeting_hours_30d ELSE NULL END
            AS ai_cost_per_meeting_hour_usd,
          CASE WHEN meeting_stats.ended_30d > 0
            THEN debrief_stats.succeeded / meeting_stats.ended_30d ELSE NULL END
            AS debrief_success_rate
        FROM meeting_stats CROSS JOIN debrief_stats`;

      const reviewDays = await sql<ReviewDayRow[]>`
        WITH days AS (
          SELECT generate_series(
            date_trunc('day', ${now}::timestamptz) - interval '13 days',
            date_trunc('day', ${now}::timestamptz), interval '1 day'
          ) AS day
        ), reviews AS (
          SELECT date_trunc('day', at) AS day, count(DISTINCT user_id)::integer AS count
          FROM review_logs
          WHERE at >= date_trunc('day', ${now}::timestamptz) - interval '13 days'
            AND at < date_trunc('day', ${now}::timestamptz) + interval '1 day'
          GROUP BY 1
        )
        SELECT to_char(days.day AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
          COALESCE(reviews.count, 0)::integer AS count
        FROM days LEFT JOIN reviews USING (day) ORDER BY days.day`;

      const row = summary!;
      return {
        generatedAt: now.toISOString(),
        activeUsers7d: row.active_users_7d,
        meetings: {
          last7Days: { count: row.meetings_7d, totalHours: row.meeting_hours_7d },
          last30Days: { count: row.meetings_30d, totalHours: row.meeting_hours_30d },
        },
        debriefLatencyMinutes: {
          median: row.debrief_median_minutes,
          p95: row.debrief_p95_minutes,
        },
        aiCostPerMeetingHourUsd: row.ai_cost_per_meeting_hour_usd,
        reviewSessions14d: reviewDays,
        debriefSuccessRate: row.debrief_success_rate,
      };
    },
  };
}
