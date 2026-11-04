import { RenameSpeakerRequestSchema, type RenameSpeakerResponse } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { parse } from '../../lib/http';
import type { SpeakersService } from './speakers.service';

const ParamsSchema = z.object({ id: z.uuid(), speakerId: z.uuid() });

/** HTTP surface only: parse input, call the service, return a shared DTO. The name is never logged. */
export function speakersRoutes(service: SpeakersService): FastifyPluginAsync {
  return async (app) => {
    app.patch(
      '/v1/sessions/:id/speakers/:speakerId',
      async (request): Promise<RenameSpeakerResponse> => {
        const { id, speakerId } = parse(ParamsSchema, request.params);
        const { displayName } = parse(RenameSpeakerRequestSchema, request.body);
        return { speaker: await service.rename(request.userId, id, speakerId, displayName) };
      },
    );
  };
}
