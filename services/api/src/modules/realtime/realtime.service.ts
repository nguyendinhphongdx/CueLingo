import {
  DEFAULT_LANGUAGE,
  ErrorCode,
  SUPPORTED_LANGUAGES,
  SpeakerLabelSchema,
  translationCostMs,
  type GlossaryTerm,
  type LanguageCode,
  type RealtimeFeature,
  type SegmentFinalMessage,
  type ServerMessage,
  type UsageItem,
} from '@cuelingo/shared';
import type { AiGateway } from '@cuelingo/ai-gateway';
import type { SessionsRepository } from '../sessions';
import type { UsageService } from '../usage';

export interface RealtimeDeps {
  gateway: Pick<AiGateway, 'llm'>;
  verifyToken(token: string): Promise<string | null>;
  glossary(
    userId: string,
    language: LanguageCode,
  ): Promise<Array<Pick<GlossaryTerm, 'term' | 'translation'>>>;
  store?: Pick<SessionsRepository, 'saveSegment' | 'saveTranslation' | 'findById'>;
}

export type RealtimeUsage = Pick<UsageService, 'status' | 'add'>;

export type RealtimeConnection = ReturnType<typeof createRealtimeConnection>;

/** Per-socket state and business rules for authentication, context and ordered translation. */
export function createRealtimeConnection(
  deps: RealtimeDeps,
  send: (message: ServerMessage) => void,
  logStoreError: (error: unknown) => void = () => undefined,
  options: {
    /** Translation time allowance, wired in `app.ts`. Absent means no limit (unit tests of the pipeline). */
    usage?: RealtimeUsage;
    /** Optional messages the client asked for in the socket URL (`?features=usage`). */
    features?: readonly RealtimeFeature[];
  } = {},
) {
  const { usage } = options;
  const features = options.features ?? [];
  let userId: string | null = null;
  let sessionId: string | null = null;
  // The language is the meeting's own; the socket does not get to choose it.
  let language: LanguageCode = DEFAULT_LANGUAGE;
  let translationQueue = Promise.resolve();
  const previousSystem: string[] = [];
  const storedSegments = new Map<string, Promise<boolean>>();
  // Each notice goes out once per connection: a socket that reconnects is told again, the client filters repeats.
  const noticesSent = new Set<'low' | 'exhausted'>();

  function notify(item: UsageItem) {
    if (item.state === 'ok' || !features.includes('usage') || noticesSent.has(item.state)) return;
    noticesSent.add(item.state);
    send({ type: 'usage', metric: 'translation_ms', state: item.state, item });
  }

  // Mic is always the user. A system sentence may carry a label of someone else; anything unusable is dropped
  // so one bad label never costs the sentence itself.
  const labelFor = (message: SegmentFinalMessage) => {
    if (message.stream === 'mic') return 'me' as const;
    const parsed = SpeakerLabelSchema.safeParse(message.speaker);
    return parsed.success && parsed.data !== 'me' ? parsed.data : null;
  };

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
      language =
        (await deps.store?.findById(userId, requestedSessionId))?.language ?? DEFAULT_LANGUAGE;
      send({ type: 'ready', sessionId: requestedSessionId });
      return true;
    },

    /** The meeting's language was changed over REST: read it again from the session, never from the socket. */
    async languageChanged(): Promise<void> {
      if (!userId || !sessionId) return;
      const session = await deps.store?.findById(userId, sessionId);
      if (session) language = session.language;
    },

    segment(message: SegmentFinalMessage): boolean {
      if (!userId) {
        rejectUnauthorized();
        return false;
      }
      const authenticatedUserId = userId;
      const meetingLanguage = language;
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
              language: meetingLanguage,
              speaker: labelFor(message),
            }),
          )
          .catch((error: unknown) => {
            logStoreError(error);
            return false;
          });
        storedSegments.set(message.segmentId, stored);
      }
      if (message.stream === 'mic') return true;
      // A meeting in a language that is not translated (Vietnamese) is stored but never sent to the LLM.
      if (!SUPPORTED_LANGUAGES[meetingLanguage].translates) return true;

      const context = previousSystem.slice(-3);
      previousSystem.push(message.text);
      translationQueue = translationQueue.then(async () => {
        try {
          // The allowance is read while the glossary is, so the gate adds no round trip to a sentence.
          const [glossary, allowance] = await Promise.all([
            deps.glossary(authenticatedUserId, meetingLanguage),
            usage?.status(authenticatedUserId, 'translation_ms'),
          ]);
          if (allowance) notify(allowance);
          // Out of time: the sentence is already stored and the captions go on; only the AI call is skipped.
          if (allowance?.state === 'exhausted') return;
          const result = await deps.gateway.llm(
            'translate.realtime',
            {
              text: message.text,
              previous: context,
              glossary,
              language: meetingLanguage,
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
          return;
        }
        // Counted after the translation is on its way. A failure here must not turn into a translation error.
        if (!usage) return;
        try {
          notify(
            await usage.add(
              authenticatedUserId,
              'translation_ms',
              translationCostMs(message.startMs, message.endMs, message.text),
            ),
          );
        } catch (error) {
          logStoreError(error);
        }
      });
      return true;
    },
  };
}
