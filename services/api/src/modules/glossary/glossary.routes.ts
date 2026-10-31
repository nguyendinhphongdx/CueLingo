import {
  CreateGlossaryTermSchema,
  UpdateGlossaryTermSchema,
  type GlossaryTerm,
  type GlossaryTermList,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { IdParamsSchema, parse } from '../../lib/http';
import type { GlossaryService } from './glossary.service';

/** HTTP surface only: parse input, call the service, return a shared DTO. No business logic here. */
export function glossaryRoutes(service: GlossaryService): FastifyPluginAsync {
  return async (app) => {
    app.get('/', async (request): Promise<GlossaryTermList> => ({
      items: await service.list(request.userId),
    }));

    app.post('/', async (request, reply): Promise<GlossaryTerm> => {
      const input = parse(CreateGlossaryTermSchema, request.body);
      reply.code(201);
      return service.create(request.userId, input);
    });

    app.patch('/:id', async (request): Promise<GlossaryTerm> => {
      const { id } = parse(IdParamsSchema, request.params);
      const patch = parse(UpdateGlossaryTermSchema, request.body);
      return service.update(request.userId, id, patch);
    });

    app.delete('/:id', async (request, reply) => {
      const { id } = parse(IdParamsSchema, request.params);
      await service.remove(request.userId, id);
      return reply.code(204).send();
    });
  };
}
