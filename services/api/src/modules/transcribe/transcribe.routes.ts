import { TranscribeRequestSchema, type TranscribeResponse } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { IdParamsSchema, parse } from '../../lib/http';
import type { TranscribeService } from './transcribe.service';

/**
 * `POST /v1/sessions/:id/transcribe`: the audio is in the body (never the URL) and is not stored.
 * Only ids, sizes and whether a speaker was recognised are logged, never the audio or the text.
 */
export function transcribeRoutes(service: TranscribeService): FastifyPluginAsync {
  return async (app) => {
    app.post(
      '/v1/sessions/:id/transcribe',
      { bodyLimit: 2_000_000 },
      async (request): Promise<TranscribeResponse> => {
        const { id } = parse(IdParamsSchema, request.params);
        const input = parse(TranscribeRequestSchema, request.body);
        const result = await service.transcribe(request.userId, id, input);
        request.log.info(
          {
            sessionId: id,
            segmentId: result.segmentId,
            pcmChars: input.pcm.length,
            textChars: result.text.length,
            speakerKnown: result.speaker?.label.startsWith('speaker_') ?? false,
          },
          'utterance transcribed',
        );
        return result;
      },
    );
  };
}
