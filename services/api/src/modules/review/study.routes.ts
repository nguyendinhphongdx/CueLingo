import { LanguageQuerySchema, ReviewAnswerRequestSchema } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { parse } from '../../lib/http';

/** `?dictation=1` tells the API this client can play and grade listen-and-type cards. */
const QueueQuerySchema = LanguageQuerySchema.extend({
  dictation: z
    .enum(['1', 'true', '0', 'false'])
    .optional()
    .transform((value) => value === '1' || value === 'true'),
});
import type { StudyService } from './study.service';

/** HTTP surface only: parse input, call the service, return a shared DTO. */
export const reviewRoutes =
  (service: StudyService): FastifyPluginAsync =>
  async (app) => {
    app.get('/queue', async (request) => {
      const { dictation, language } = parse(QueueQuerySchema, request.query);
      return service.queue(request.userId, { dictation, language });
    });
    app.post('/answer', async (request) =>
      service.answer(request.userId, parse(ReviewAnswerRequestSchema, request.body)),
    );
  };

export const progressRoutes =
  (service: StudyService): FastifyPluginAsync =>
  async (app) => {
    app.get('/', async (request) =>
      service.progress(request.userId, parse(LanguageQuerySchema, request.query).language),
    );
  };
