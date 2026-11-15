import {
  AdminDashboardSchema,
  AdminSetUserPlanRequestSchema,
  AdminSetUserPlanResponseSchema,
  AdminUserDetailSchema,
  AdminUserListQuerySchema,
  AdminUserListSchema,
  type AdminDashboard,
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
      /** Sets the plan by hand. `400` when `expiresAt` is in the past. The admin is the session, never a field. */
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
