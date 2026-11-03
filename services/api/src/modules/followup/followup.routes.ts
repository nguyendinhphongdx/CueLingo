import { FollowupRequestSchema, type FollowupResponse } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { IdParamsSchema, parse } from '../../lib/http';
import type { FollowupService } from './followup.service';

/** `POST /v1/sessions/:id/followup`. Never logs the debrief or the draft, only ids and sizes. */
export function followupRoutes(service: FollowupService): FastifyPluginAsync {
  return async (app) => {
    app.post('/v1/sessions/:id/followup', async (request): Promise<FollowupResponse> => {
      const { id } = parse(IdParamsSchema, request.params);
      const input = parse(FollowupRequestSchema, request.body);
      const result = await service.draft(request.userId, id, input);
      request.log.info(
        {
          sessionId: id,
          channel: input.channel,
          tone: input.tone,
          bodyChars: result.body.length,
        },
        'follow-up drafted',
      );
      return result;
    });
  };
}
