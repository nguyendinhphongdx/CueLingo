import {
  AdminDashboardSchema,
  AdminSetUserPlanResponseSchema,
  AdminUserDetailSchema,
  AdminUserListSchema,
  type AdminDashboard,
  type AdminSetUserPlanResponse,
  type AdminUserDetail,
  type AdminUserList,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { AdminUsersService } from './admin-users.service';

/**
 * HTTP surface only. Full paths, like invites, so `app.ts` adds no prefix. Answers go through the strict
 * schemas, so a field that should not leave (meeting content, a payment link) fails loudly instead of leaking.
 */
export function adminUsersRoutes(service: AdminUsersService): FastifyPluginAsync {
  return async (app) => {
    app.get('/v1/admin/dashboard', async (request): Promise<AdminDashboard> => {
      return AdminDashboardSchema.parse(await service.dashboard(request.userId));
    });

    app.get('/v1/admin/users', async (request): Promise<AdminUserList> => {
      return AdminUserListSchema.parse(await service.list(request.userId, request.query));
    });

    app.get('/v1/admin/users/:id', async (request): Promise<AdminUserDetail> => {
      return AdminUserDetailSchema.parse(await service.detail(request.userId, request.params));
    });

    app.put('/v1/admin/users/:id/plan', async (request): Promise<AdminSetUserPlanResponse> => {
      return AdminSetUserPlanResponseSchema.parse(
        await service.setPlan(request.userId, request.params, request.body),
      );
    });
  };
}
