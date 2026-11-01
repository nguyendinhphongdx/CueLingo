import { PostEventsRequestSchema } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/http';
import type { EventsService } from './events.service';

/** HTTP surface only: validate a batch, append it, then return no content. */
export function eventsRoutes(service: EventsService): FastifyPluginAsync {
  return async (app) => {
    app.post('/', async (request, reply) => {
      const { events } = parse(PostEventsRequestSchema, request.body);
      await service.append(request.userId, events);
      return reply.code(204).send();
    });
  };
}
