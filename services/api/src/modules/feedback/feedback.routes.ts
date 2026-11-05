import { CreateFeedbackRequestSchema, type Feedback } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/http';
import type { FeedbackService } from './feedback.service';

export function feedbackRoutes(service: FeedbackService): FastifyPluginAsync {
  return async (app) => {
    // The user id comes from the session; the body schema is strict and has no user field.
    app.post('/v1/feedback', async (request, reply): Promise<Feedback> => {
      const input = parse(CreateFeedbackRequestSchema, request.body);
      reply.code(201);
      return service.create(request.userId, input);
    });
  };
}
