import {
  ErrorCode,
  type GlossaryTerm,
  type SegmentFinalMessage,
  type ServerMessage,
} from '@cuelingo/shared';
import type { AiGateway } from '@cuelingo/ai-gateway';

export interface RealtimeDeps {
  gateway: Pick<AiGateway, 'llm'>;
  verifyToken(token: string): Promise<string | null>;
  glossary(userId: string): Promise<Array<Pick<GlossaryTerm, 'term' | 'translation'>>>;
}

export type RealtimeConnection = ReturnType<typeof createRealtimeConnection>;

/** Per-socket state and business rules for authentication, context and ordered translation. */
export function createRealtimeConnection(
  deps: RealtimeDeps,
  send: (message: ServerMessage) => void,
) {
  let userId: string | null = null;
  let translationQueue = Promise.resolve();
  const previousSystem: string[] = [];

  const rejectUnauthorized = () => {
    send({ type: 'error', code: ErrorCode.WsUnauthorized, retryable: false });
  };

  return {
    async hello(token: string, sessionId: string): Promise<boolean> {
      userId = await deps.verifyToken(token);
      if (!userId) {
        rejectUnauthorized();
        return false;
      }
      send({ type: 'ready', sessionId });
      return true;
    },

    segment(message: SegmentFinalMessage): boolean {
      if (!userId) {
        rejectUnauthorized();
        return false;
      }
      if (message.stream === 'mic') return true;

      const context = previousSystem.slice(-3);
      previousSystem.push(message.text);
      const authenticatedUserId = userId;
      translationQueue = translationQueue.then(async () => {
        try {
          const glossary = await deps.glossary(authenticatedUserId);
          const result = await deps.gateway.llm('translate.realtime', {
            text: message.text,
            previous: context,
            glossary,
          });
          send({
            type: 'translation',
            segmentId: message.segmentId,
            textVi: result.text,
            hardWords: [],
          });
        } catch {
          send({ type: 'error', code: ErrorCode.WsTranslationFailed, retryable: true });
        }
      });
      return true;
    },
  };
}
