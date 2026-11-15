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
export function assistRoutes(
  service: AssistService,
  /** Takes one use of the daily allowance, or throws 429 `QUOTA_EXCEEDED`. Runs before any AI call. */
  gate: (userId: string) => Promise<void>,
): FastifyPluginAsync {
  return async (app) => {
    app.post('/lookup', async (request): Promise<LookupResponse> => {
      const input = parse(LookupRequestSchema, request.body);
      await gate(request.userId);
      return service.lookup(request.userId, input);
    });

    app.post('/recap', async (request): Promise<RecapResponse> => {
      const input = parse(RecapRequestSchema, request.body);
      await gate(request.userId);
      return service.recap(request.userId, input);
    });

    app.post('/compose', async (request): Promise<ComposeResponse> => {
      const input = parse(ComposeRequestSchema, request.body);
      await gate(request.userId);
      return service.compose(request.userId, input);
    });
  };
}
