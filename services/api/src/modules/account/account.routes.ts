import { DeleteAccountRequestSchema, UpdateMeRequestSchema, type Me } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/http';
import type { AccountService } from './account.service';

/** `/v1/me`: read, rename and close the signed-in person's own account. Data export lives in `privacy`. */
export function accountRoutes(service: AccountService): FastifyPluginAsync {
  return async (app) => {
    app.get('/v1/me', async (request): Promise<Me> => service.get(request.userId));

    app.patch('/v1/me', async (request): Promise<Me> => {
      const { name } = parse(UpdateMeRequestSchema, request.body);
      return service.rename(request.userId, name);
    });

    app.delete('/v1/me', async (request, reply) => {
      parse(DeleteAccountRequestSchema, request.body);
      await service.close(request.userId);
      return reply.code(204).send();
    });
  };
}
