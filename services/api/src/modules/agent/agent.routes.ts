import { SendMessageRequestSchema } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { IdParamsSchema, parse } from '../../lib/http';
import type { AgentService } from './agent.service';

/** HTTP surface only: parse input, start the turn, send its event stream. No business logic here. */
export function agentRoutes(service: AgentService): FastifyPluginAsync {
  return async (app) => {
    app.post('/:id/messages', async (request, reply) => {
      const { id } = parse(IdParamsSchema, request.params);
      const input = parse(SendMessageRequestSchema, request.body);
      const stream = await service.send(request.userId, id, input, request.log);

      // The client leaving ends the turn (stored as `stopped`, keeping the text so far).
      reply.raw.once('close', () => {
        if (!reply.raw.writableFinished) stream.destroy();
      });
      // `reply.send(stream)`, not `hijack`: the CORS and request-id hooks still add their headers. No compression
      // plugin is registered, and the proxy hints keep nginx and friends from buffering the events.
      return reply
        .header('Content-Type', 'text/event-stream; charset=utf-8')
        .header('Cache-Control', 'no-cache, no-transform')
        .header('X-Accel-Buffering', 'no')
        .send(stream);
    });
  };
}
