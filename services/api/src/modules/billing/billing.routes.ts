import {
  CreateOrderRequestSchema,
  type BillingOrder,
  type BillingOrderList,
  type BillingOverviewResponse,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { IdParamsSchema, parse } from '../../lib/http';
import type { BillingService } from './billing.service';

/** HTTP surface only. Declared with full paths, like usage, so `app.ts` adds no prefix. */
export function billingRoutes(service: BillingService): FastifyPluginAsync {
  return async (app) => {
    app.get('/v1/billing', async (request): Promise<BillingOverviewResponse> => {
      return service.overview(request.userId);
    });

    app.post('/v1/billing/orders', async (request, reply): Promise<BillingOrder> => {
      const input = parse(CreateOrderRequestSchema, request.body);
      const order = await service.createOrder(request.userId, input);
      reply.code(201);
      return order;
    });

    app.get('/v1/billing/orders', async (request): Promise<BillingOrderList> => {
      return service.listOrders(request.userId);
    });

    app.get('/v1/billing/orders/:id', async (request): Promise<BillingOrder> => {
      const { id } = parse(IdParamsSchema, request.params);
      return service.getOrder(request.userId, id);
    });

    // Public (see lib/auth.ts): the payment provider calls it; the signature is the authentication.
    app.post('/v1/billing/webhook/payos', async (request) => {
      await service.handleWebhook(request.body);
      return { ok: true };
    });
  };
}
