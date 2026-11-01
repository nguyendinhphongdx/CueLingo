import {
  ComposeRequestSchema,
  LookupRequestSchema,
  RecapRequestSchema,
  type ComposeResponse,
  type LookupResponse,
  type RecapResponse,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/http';
import type { AssistService } from './assist.service';

/** HTTP surface only: validate shared request DTOs and delegate to the assist service. */
export function assistRoutes(service: AssistService): FastifyPluginAsync {
  return async (app) => {
    app.post('/lookup', async (request): Promise<LookupResponse> => {
      return service.lookup(parse(LookupRequestSchema, request.body));
    });

    app.post('/recap', async (request): Promise<RecapResponse> => {
      return service.recap(parse(RecapRequestSchema, request.body));
    });

    app.post('/compose', async (request): Promise<ComposeResponse> => {
      return service.compose(parse(ComposeRequestSchema, request.body));
    });
  };
}
