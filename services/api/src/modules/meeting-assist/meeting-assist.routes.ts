import type { Readable } from 'node:stream';
import {
  AskMeetingRequestSchema,
  SetMeetingAssistConsentRequestSchema,
  type MeetingAssistStatus,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { IdParamsSchema, parse } from '../../lib/http';
import type { MeetingAssistService } from './meeting-assist.service';

/** HTTP surface only: parse input, call the service, send its event stream. No business logic here. */
export function meetingAssistRoutes(service: MeetingAssistService): FastifyPluginAsync {
  return async (app) => {
    app.get('/v1/me/meeting-assist', async (request): Promise<MeetingAssistStatus> =>
      service.status(request.userId),
    );

    app.put('/v1/me/meeting-assist/consent', async (request): Promise<MeetingAssistStatus> => {
      const { granted } = parse(SetMeetingAssistConsentRequestSchema, request.body);
      return service.setConsent(request.userId, granted);
    });

    app.post('/v1/sessions/:id/questions', async (request, reply) => {
      service.assertEnabled();
      const { id } = parse(IdParamsSchema, request.params);
      const input = parse(AskMeetingRequestSchema, request.body);
      // Listening before the service runs, so a client that leaves early still ends the answer.
      let gone = false;
      const turn: { stream?: Readable } = {};
      reply.raw.once('close', () => {
        gone = true;
        if (!reply.raw.writableFinished) turn.stream?.destroy();
      });
      const stream = await service.ask(request.userId, id, input, request.log);
      turn.stream = stream;
      if (gone || reply.raw.destroyed) stream.destroy();
      return reply
        .header('Content-Type', 'text/event-stream; charset=utf-8')
        .header('Cache-Control', 'no-cache, no-transform')
        .header('X-Accel-Buffering', 'no')
        .send(stream);
    });
  };
}
