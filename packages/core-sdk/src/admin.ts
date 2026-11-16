import {
  AdminAccessSchema,
  AdminActivitySchema,
  AdminDashboardSchema,
  AdminOverviewSchema,
  AdminRevenueSchema,
  AdminSetUserPlanRequestSchema,
  AdminSetUserPlanResponseSchema,
  AdminUserDetailSchema,
  AdminUserListQuerySchema,
  AdminUserListSchema,
  AdminUsageSchema,
  type AdminAccess,
  type AdminActivity,
  type AdminDashboard,
  type AdminOverview,
  type AdminRevenue,
  type AdminUsage,
  type AdminSetUserPlanRequest,
  type AdminSetUserPlanResponse,
  type AdminUserDetail,
  type AdminUserList,
  type AdminUserListQuery,
} from '@cuelingo/shared';
import type { Http } from './http';

/** Admin only: every call answers `403` for a signed-in user who is not in `ADMIN_EMAILS`. */
export function adminApi(http: Http) {
  return {
    /** Whether the signed-in person is an admin. Never `403`: a normal user gets `{isAdmin: false}`. */
    access(): Promise<AdminAccess> {
      return http.request('GET', '/v1/admin/me', AdminAccessSchema);
    },
    /** Aggregates only (no identifiers); the API caches each for 60 seconds. */
    analytics: {
      overview(): Promise<AdminOverview> {
        return http.request('GET', '/v1/admin/analytics/overview', AdminOverviewSchema);
      },
      revenue(): Promise<AdminRevenue> {
        return http.request('GET', '/v1/admin/analytics/revenue', AdminRevenueSchema);
      },
      usage(): Promise<AdminUsage> {
        return http.request('GET', '/v1/admin/analytics/usage', AdminUsageSchema);
      },
      activity(): Promise<AdminActivity> {
        return http.request('GET', '/v1/admin/analytics/activity', AdminActivitySchema);
      },
    },
    /** Counts of people by plan, new sign-ups, this month's revenue (VND) and plans ending soon. */
    dashboard(): Promise<AdminDashboard> {
      return http.request('GET', '/v1/admin/dashboard', AdminDashboardSchema);
    },
    users: {
      /** 50 people, newest sign-up first. Pass the previous page's `nextCursor` as `cursor` for the next page. */
      list(query: AdminUserListQuery = {}): Promise<AdminUserList> {
        const params = new URLSearchParams();
        const checked = AdminUserListQuerySchema.parse(query);
        for (const [key, value] of Object.entries(checked)) {
          if (value !== undefined && value !== '') params.set(key, String(value));
        }
        const text = params.toString();
        return http.request(
          'GET',
          text ? `/v1/admin/users?${text}` : '/v1/admin/users',
          AdminUserListSchema,
        );
      },
      /** One person's plan, this month's usage and orders. `404` when the id is unknown. */
      get(id: string): Promise<AdminUserDetail> {
        return http.request(
          'GET',
          `/v1/admin/users/${encodeURIComponent(id)}`,
          AdminUserDetailSchema,
        );
      },
      /** Grants a plan like a purchase without payment: `period` is required for Pro/Ultra and absent for Free; the server works out the end date and records a 0 dong order. The admin is the session, never a field. */
      setPlan(id: string, input: AdminSetUserPlanRequest): Promise<AdminSetUserPlanResponse> {
        return http.request(
          'PUT',
          `/v1/admin/users/${encodeURIComponent(id)}/plan`,
          AdminSetUserPlanResponseSchema,
          AdminSetUserPlanRequestSchema.parse(input),
        );
      },
    },
  };
}
