import type { AssistSuggestion } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { DialService } from './dial.service';

/** `GET /v1/me/assist-suggestion`: whether to offer a different assist level right now. */
export function dialRoutes(service: DialService): FastifyPluginAsync {
  return async (app) => {
    app.get('/v1/me/assist-suggestion', async (request): Promise<AssistSuggestion> =>
      service.suggestion(request.userId),
    );
  };
}
