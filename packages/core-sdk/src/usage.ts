import {
  SetPlanResponseSchema,
  UsageResponseSchema,
  type SetPlanRequest,
  type SetPlanResponse,
  type UsageResponse,
} from '@cuelingo/shared';
import type { Http } from './http';

export function usageApi(http: Http) {
  return {
    /** The signed-in user's plan and every allowance (`limit: null` = unlimited). */
    get(): Promise<UsageResponse> {
      return http.request('GET', '/v1/me/usage', UsageResponseSchema);
    },
    /** Admin only: set the plan of the person with this email. `403` for everyone else. */
    setPlan(input: SetPlanRequest): Promise<SetPlanResponse> {
      return http.request('PUT', '/v1/admin/plan', SetPlanResponseSchema, input);
    },
  };
}
