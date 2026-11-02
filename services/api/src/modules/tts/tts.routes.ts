import { TtsRequestSchema } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/http';
import type { TtsService } from './tts.service';

/**
 * `POST /v1/tts`: the text goes in the body, not the URL, so what people practise never lands in a log.
 * Audio is deterministic per text, so clients may keep it for a long time.
 */
export function ttsRoutes(service: TtsService): FastifyPluginAsync {
  return async (app) => {
    app.post('/', async (request, reply) => {
      const { text } = parse(TtsRequestSchema, request.body);
      const { audio, cache } = await service.speak(request.userId, text);
      return reply
        .type('audio/wav')
        .header('x-tts-cache', cache)
        .header('cache-control', 'private, max-age=604800')
        .send(Buffer.from(audio));
    });
  };
}
