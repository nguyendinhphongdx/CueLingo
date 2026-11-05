import {
  CreateConversationRequestSchema,
  RenameConversationRequestSchema,
  type Conversation,
  type ConversationDetail,
  type ConversationList,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { IdParamsSchema, parse } from '../../lib/http';
import type { ConversationsService } from './conversations.service';

/** HTTP surface only: parse input, call the service, return a shared DTO. No business logic here. */
export function conversationsRoutes(service: ConversationsService): FastifyPluginAsync {
  return async (app) => {
    app.get('/', async (request): Promise<ConversationList> => {
      return { items: await service.list(request.userId) };
    });

    app.post('/', async (request, reply): Promise<Conversation> => {
      const input = parse(CreateConversationRequestSchema, request.body ?? {});
      reply.code(201);
      return service.create(request.userId, input);
    });

    app.get('/:id', async (request): Promise<ConversationDetail> => {
      const { id } = parse(IdParamsSchema, request.params);
      return service.get(request.userId, id);
    });

    app.patch('/:id', async (request): Promise<Conversation> => {
      const { id } = parse(IdParamsSchema, request.params);
      const { title } = parse(RenameConversationRequestSchema, request.body);
      return service.rename(request.userId, id, title);
    });

    app.delete('/:id', async (request, reply) => {
      const { id } = parse(IdParamsSchema, request.params);
      await service.remove(request.userId, id);
      return reply.code(204).send();
    });
  };
}
