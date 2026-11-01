import { DeleteMyDataRequestSchema, type Export } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/http';
import type { PrivacyService } from './privacy.service';

export function privacyRoutes(service: PrivacyService): FastifyPluginAsync {
  return async (app) => {
    app.delete('/v1/me/data', async (request, reply) => {
      parse(DeleteMyDataRequestSchema, request.body);
      await service.deleteMyData(request.userId);
      return reply.code(204).send();
    });

    app.get('/v1/me/export', async (request): Promise<Export> =>
      service.exportMyData(request.userId),
    );
  };
}
