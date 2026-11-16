import { SetPlanRequestSchema, type SetPlanResponse, type UsageResponse } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/http';
import type { UsageService } from './usage.service';

/** HTTP surface only. Both routes are declared with full paths, like invites, so `app.ts` adds no prefix. */
export function usageRoutes(service: UsageService): FastifyPluginAsync {
  return async (app) => {
    app.get('/v1/me/usage', async (request): Promise<UsageResponse> => {
      return service.snapshot(request.userId);
    });

    app.put('/v1/admin/plan', async (request): Promise<SetPlanResponse> => {
      const input = parse(SetPlanRequestSchema, request.body);
      return service.setPlan(request.userId, input.email, input.plan, input.period);
    });
  };
}
