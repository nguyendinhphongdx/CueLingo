import {
  LanguageQuerySchema,
  SavePhraseRequestSchema,
  type Phrase,
  type PhraseList,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { IdParamsSchema, parse } from '../../lib/http';
import type { PhrasesService } from './phrases.service';

/** HTTP surface only: parse input, call the service, return a shared DTO. */
export function phrasesRoutes(service: PhrasesService): FastifyPluginAsync {
  return async (app) => {
    app.get('/', async (request): Promise<PhraseList> => {
      const { language } = parse(LanguageQuerySchema, request.query);
      return { phrases: await service.list(request.userId, language) };
    });

    app.post('/', async (request, reply): Promise<Phrase> => {
      const input = parse(SavePhraseRequestSchema, request.body);
      reply.code(201);
      return service.save(request.userId, input);
    });

    app.delete('/:id', async (request, reply) => {
      const { id } = parse(IdParamsSchema, request.params);
      await service.remove(request.userId, id);
      return reply.code(204).send();
    });
  };
}
