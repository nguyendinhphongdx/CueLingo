import {
  DeviceExchangeRequestSchema,
  type DeviceCodeResponse,
  type DeviceExchangeResponse,
  type DeviceTokenList,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { IdParamsSchema, parse } from '../../lib/http';
import type { DeviceService } from './device.service';

const bearer = (header: string | undefined) => /^Bearer\s+(.+)$/.exec(header ?? '')?.[1] ?? null;

/**
 * `/v1/device`: `code` and the device list need a web session (the auth hook never lets a device token
 * mint more tokens); `exchange` is public because the app has no credentials yet.
 */
export function deviceRoutes(service: DeviceService): FastifyPluginAsync {
  return async (app) => {
    app.post('/code', async (request): Promise<DeviceCodeResponse> =>
      service.issueCode(request.userId),
    );

    app.post('/exchange', async (request): Promise<DeviceExchangeResponse> => {
      const { code, label } = parse(DeviceExchangeRequestSchema, request.body);
      return service.exchange(code, label);
    });

    app.get('/tokens', async (request): Promise<DeviceTokenList> => ({
      devices: await service.list(request.userId),
    }));

    app.delete('/tokens/:id', async (request, reply) => {
      const { id } = parse(IdParamsSchema, request.params);
      await service.revoke(request.userId, id);
      return reply.code(204).send();
    });

    app.delete('/token', async (request, reply) => {
      const token = bearer(request.headers.authorization);
      if (token) await service.revokeSelf(token);
      return reply.code(204).send();
    });
  };
}
