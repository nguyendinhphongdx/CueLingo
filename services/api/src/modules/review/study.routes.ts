import { ReviewAnswerRequestSchema } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/http';
import type { StudyService } from './study.service';

/** HTTP surface only: parse input, call the service, return a shared DTO. */
export const reviewRoutes =
  (service: StudyService): FastifyPluginAsync =>
  async (app) => {
    app.get('/queue', async (request) => service.queue(request.userId));
    app.post('/answer', async (request) =>
      service.answer(request.userId, parse(ReviewAnswerRequestSchema, request.body)),
    );
  };

export const progressRoutes =
  (service: StudyService): FastifyPluginAsync =>
  async (app) => {
    app.get('/', async (request) => service.progress(request.userId));
  };
