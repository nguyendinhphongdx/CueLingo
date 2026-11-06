import {
  AdminAgentStatusSchema,
  AdminMetricsSchema,
  UpdateAdminAgentRequestSchema,
  type AdminAgentStatus,
  type AdminMetrics,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/http';
import type { AdminService } from './admin.service';

export function adminRoutes(service: AdminService): FastifyPluginAsync {
  return async (app) => {
    app.get('/metrics', async (request): Promise<AdminMetrics> => {
      return AdminMetricsSchema.parse(await service.metrics(request.userId));
    });
    app.get('/agent', async (request): Promise<AdminAgentStatus> => {
      return AdminAgentStatusSchema.parse(await service.agentStatus(request.userId));
    });
    app.patch('/agent', async (request): Promise<AdminAgentStatus> => {
      const input = parse(UpdateAdminAgentRequestSchema, request.body);
      const status = await service.updateAgent(request.userId, input);
      // Ids and the new state only: no user data is involved.
      request.log.info(
        { change: input.plugin ? { plugin: input.plugin } : { enabled: input.enabled } },
        'agent switch changed',
      );
      return AdminAgentStatusSchema.parse(status);
    });
  };
}
