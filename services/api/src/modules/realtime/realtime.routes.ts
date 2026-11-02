import {
  ClientMessageSchema,
  ErrorCode,
  ServerMessageSchema,
  type ServerMessage,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import { createRealtimeConnection, type RealtimeDeps } from './realtime.service';

const send = (socket: WebSocket, message: ServerMessage) => {
  socket.send(JSON.stringify(ServerMessageSchema.parse(message)));
};

const parseMessage = (data: RawData) => {
  try {
    return ClientMessageSchema.safeParse(JSON.parse(data.toString()));
  } catch {
    return ClientMessageSchema.safeParse(null);
  }
};

/** WebSocket transport only: validate shared messages and delegate connection state to the service. */
export function realtimeRoutes(deps: RealtimeDeps): FastifyPluginAsync {
  return async (app) => {
    app.get('/v1/sessions/:id/stream', { websocket: true }, (socket, request) => {
      const connection = createRealtimeConnection(
        deps,
        (message) => send(socket, message),
        (error) => request.log.error({ err: error }, 'Realtime segment persistence failed'),
      );
      let messageQueue = Promise.resolve();

      socket.on('message', (data) => {
        const parsed = parseMessage(data);
        if (!parsed.success) {
          send(socket, { type: 'error', code: ErrorCode.WsBadMessage, retryable: false });
          return;
        }

        const message = parsed.data;
        messageQueue = messageQueue
          .then(async () => {
            if (message.type === 'hello') {
              if (!(await connection.hello(message.token, message.sessionId))) socket.close();
              return;
            }
            if (message.type === 'language.set') {
              await connection.languageChanged();
              return;
            }
            if (message.type === 'segment.final' && !connection.segment(message)) socket.close();
          })
          .catch((error: unknown) =>
            request.log.error({ err: error }, 'WebSocket message handling failed'),
          );
      });
    });
  };
}
