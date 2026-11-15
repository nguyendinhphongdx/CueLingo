import {
  ClientMessageSchema,
  ErrorCode,
  REALTIME_FEATURES,
  ServerMessageSchema,
  type RealtimeFeature,
  type ServerMessage,
} from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import {
  createRealtimeConnection,
  type RealtimeDeps,
  type RealtimeUsage,
} from './realtime.service';

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

/** `?features=usage,...` — unknown names are ignored so a newer client works against this server. */
const featuresOf = (query: unknown): RealtimeFeature[] => {
  const raw = (query as { features?: unknown } | undefined)?.features;
  const names = typeof raw === 'string' ? raw.split(',') : [];
  return REALTIME_FEATURES.filter((feature) => names.includes(feature));
};

/** WebSocket transport only: validate shared messages and delegate connection state to the service. */
export function realtimeRoutes(deps: RealtimeDeps, usage: RealtimeUsage): FastifyPluginAsync {
  return async (app) => {
    app.get('/v1/sessions/:id/stream', { websocket: true }, (socket, request) => {
      const connection = createRealtimeConnection(
        deps,
        (message) => send(socket, message),
        (error) => request.log.error({ err: error }, 'Realtime segment persistence failed'),
        { usage, features: featuresOf(request.query) },
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
