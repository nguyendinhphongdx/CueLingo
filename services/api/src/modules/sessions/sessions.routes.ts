import {
  CreateSessionRequestSchema,
  type Session,
  type SessionDetail,
  type SessionList,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { IdParamsSchema, parse } from '../../lib/http';
import type { SessionsService } from './sessions.service';

export function sessionsRoutes(service: SessionsService): FastifyPluginAsync {
  return async (app) => {
    app.get('/', async (request): Promise<SessionList> => ({
      sessions: await service.list(request.userId),
    }));
    app.post('/', async (request, reply): Promise<Session> => {
      const input = parse(CreateSessionRequestSchema, request.body);
      reply.code(201);
      return service.create(request.userId, input);
    });
    app.get('/:id', async (request): Promise<SessionDetail> => {
      const { id } = parse(IdParamsSchema, request.params);
      return service.detail(request.userId, id);
    });
    app.post('/:id/end', async (request): Promise<Session> => {
      const { id } = parse(IdParamsSchema, request.params);
      return service.end(request.userId, id);
    });
    app.delete('/:id', async (request, reply) => {
      const { id } = parse(IdParamsSchema, request.params);
      await service.remove(request.userId, id);
      return reply.code(204).send();
    });
  };
}
