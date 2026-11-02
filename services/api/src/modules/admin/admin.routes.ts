import { AdminMetricsSchema, type AdminMetrics } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { AdminService } from './admin.service';

export function adminRoutes(service: AdminService): FastifyPluginAsync {
  return async (app) => {
    app.get('/metrics', async (request): Promise<AdminMetrics> => {
      return AdminMetricsSchema.parse(await service.metrics(request.userId));
    });
  };
}
