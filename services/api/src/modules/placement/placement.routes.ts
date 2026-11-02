import {
  LanguageQuerySchema,
  SubmitPlacementRequestSchema,
  type PlacementResult,
  type PlacementTest,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/http';
import type { PlacementService } from './placement.service';

/** `GET /v1/placement?language=` the test; `POST /v1/placement` score it and save the level. */
export function placementRoutes(service: PlacementService): FastifyPluginAsync {
  return async (app) => {
    app.get('/v1/placement', async (request): Promise<PlacementTest> =>
      service.test(parse(LanguageQuerySchema, request.query).language),
    );
    app.post('/v1/placement', async (request): Promise<PlacementResult> =>
      service.submit(request.userId, parse(SubmitPlacementRequestSchema, request.body)),
    );
  };
}
