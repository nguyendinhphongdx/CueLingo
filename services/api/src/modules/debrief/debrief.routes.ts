import { DebriefFeedbackRequestSchema, type Debrief } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { IdParamsSchema, parse } from '../../lib/http';
import type { DebriefService } from './debrief.service';

export function debriefRoutes(service: DebriefService): FastifyPluginAsync {
  return async (app) => {
    app.get('/v1/sessions/:id/debrief', async (request): Promise<Debrief> => {
      const { id } = parse(IdParamsSchema, request.params);
      return service.latest(request.userId, id);
    });
    app.post('/v1/debriefs/:id/feedback', async (request, reply) => {
      const { id } = parse(IdParamsSchema, request.params);
      const input = parse(DebriefFeedbackRequestSchema, request.body);
      await service.feedback(request.userId, id, input);
      return reply.code(204).send();
    });
  };
}
