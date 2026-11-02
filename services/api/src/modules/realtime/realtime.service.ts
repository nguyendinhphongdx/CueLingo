import {
  ErrorCode,
  type GlossaryTerm,
  type SegmentFinalMessage,
  type ServerMessage,
} from '@cuelingo/shared';
import type { AiGateway } from '@cuelingo/ai-gateway';
import type { SessionsRepository } from '../sessions';

export interface RealtimeDeps {
  gateway: Pick<AiGateway, 'llm'>;
  verifyToken(token: string): Promise<string | null>;
  glossary(userId: string): Promise<Array<Pick<GlossaryTerm, 'term' | 'translation'>>>;
  store?: Pick<SessionsRepository, 'saveSegment' | 'saveTranslation'>;
}

export type RealtimeConnection = ReturnType<typeof createRealtimeConnection>;

/** Per-socket state and business rules for authentication, context and ordered translation. */
export function createRealtimeConnection(
  deps: RealtimeDeps,
  send: (message: ServerMessage) => void,
  logStoreError: (error: unknown) => void = () => undefined,
) {
  let userId: string | null = null;
  let sessionId: string | null = null;
  let translationQueue = Promise.resolve();
  const previousSystem: string[] = [];
  const storedSegments = new Map<string, Promise<boolean>>();

  const rejectUnauthorized = () => {
    send({ type: 'error', code: ErrorCode.WsUnauthorized, retryable: false });
  };

  return {
    async hello(token: string, requestedSessionId: string): Promise<boolean> {
      userId = await deps.verifyToken(token);
      if (!userId) {
        rejectUnauthorized();
        return false;
      }
      // Ownership is checked by saveSegment. Missing/foreign sessions remain usable but are not stored.
      sessionId = requestedSessionId;
      send({ type: 'ready', sessionId: requestedSessionId });
      return true;
    },

    segment(message: SegmentFinalMessage): boolean {
      if (!userId) {
        rejectUnauthorized();
        return false;
      }
      const authenticatedUserId = userId;
      const activeSessionId = sessionId;
      if (deps.store && activeSessionId) {
        const stored = Promise.resolve()
          .then(() =>
            deps.store!.saveSegment({
              sessionId: activeSessionId,
              userId: authenticatedUserId,
              segmentId: message.segmentId,
              source: message.stream,
              startMs: message.startMs,
              endMs: message.endMs,
              textEn: message.text,
            }),
          )
          .catch((error: unknown) => {
            logStoreError(error);
            return false;
          });
        storedSegments.set(message.segmentId, stored);
      }
      if (message.stream === 'mic') return true;

      const context = previousSystem.slice(-3);
      previousSystem.push(message.text);
      translationQueue = translationQueue.then(async () => {
        try {
          const glossary = await deps.glossary(authenticatedUserId);
          const result = await deps.gateway.llm(
            'translate.realtime',
            {
              text: message.text,
              previous: context,
              glossary,
            },
            {
              userId: authenticatedUserId,
              sessionId: activeSessionId ?? undefined,
            },
          );
          send({
            type: 'translation',
            segmentId: message.segmentId,
            textVi: result.text,
            hardWords: [],
          });
          const stored = storedSegments.get(message.segmentId);
          if (deps.store && stored) {
            void stored.then(async (canUpdate) => {
              if (!canUpdate) return;
              try {
                await deps.store!.saveTranslation(message.segmentId, result.text);
              } catch (error) {
                logStoreError(error);
              }
            });
          }
        } catch {
          send({ type: 'error', code: ErrorCode.WsTranslationFailed, retryable: true });
        }
      });
      return true;
    },
  };
}
