import { Readable } from 'node:stream';
import type { AiGateway } from '@cuelingo/ai-gateway';
import { MEETING_ASK_PROMPT_VERSION } from '@cuelingo/prompts';
import {
  ErrorCode,
  MEETING_ANSWER_MAX,
  MEETING_ASSIST_CONSENT_VERSION,
  stripSourceTags,
  type AskMeetingRequest,
  type MeetingAnswerSource,
  type MeetingAnswerStatus,
  type MeetingAskStreamEvent,
  type MeetingAssistStatus,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { SessionsRepository } from '../sessions';
import type { UsageService } from '../usage';
import { citedSources } from './citations';
import { buildContext, type ContextSources } from './meeting-assist.context';
import type { MeetingAssistRepository } from './meeting-assist.repository';

export type MeetingAssistService = ReturnType<typeof createMeetingAssistService>;

export interface MeetingAssistServiceDeps {
  /** False (flag off or no AI key) refuses questions with 503 `MEETING_ASSIST_DISABLED`. */
  enabled: boolean;
  gateway?: Pick<AiGateway, 'ask'>;
  repo: MeetingAssistRepository;
  sessions: Pick<SessionsRepository, 'findDetail'>;
  usage: Pick<UsageService, 'reserve'>;
  listGlossary: ContextSources['listGlossary'];
  listPhrases: ContextSources['listPhrases'];
  now?: () => Date;
}

/** Only ids, counts and durations are logged: never a question, an answer or a transcript. */
export interface MeetingAssistLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
}

const frame = (event: MeetingAskStreamEvent): string =>
  `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

/**
 * One question: gates (disabled, consent, owner, busy, quota) → stores it → gathers context → streams one
 * model call → keeps the answer.
 */
export function createMeetingAssistService(deps: MeetingAssistServiceDeps) {
  const enabled = deps.enabled && Boolean(deps.gateway);
  const now = deps.now ?? (() => new Date());
  // One question at a time per person. In memory is enough while the API is a single container (ADR 0011).
  const running = new Map<string, symbol>();

  const hasConsent = async (userId: string): Promise<boolean> =>
    (await deps.repo.consentVersion(userId)) === MEETING_ASSIST_CONSENT_VERSION;

  return {
    async status(userId: string): Promise<MeetingAssistStatus> {
      return { enabled, consent: await hasConsent(userId) };
    },

    async setConsent(userId: string, granted: boolean): Promise<MeetingAssistStatus> {
      if (granted) await deps.repo.grantConsent(userId, MEETING_ASSIST_CONSENT_VERSION);
      else await deps.repo.revokeConsent(userId);
      return { enabled, consent: granted };
    },

    /** Checked before the request body is read, so a turned-off server always says so. */
    assertEnabled(): void {
      if (!enabled) {
        throw new AppError(ErrorCode.MeetingAssistDisabled, 'The meeting assistant is turned off');
      }
    },

    /** Everything that can refuse the question throws here, before any byte is streamed. */
    async ask(
      userId: string,
      sessionId: string,
      request: AskMeetingRequest,
      log?: MeetingAssistLogger,
    ): Promise<Readable> {
      this.assertEnabled();
      if (!(await hasConsent(userId))) {
        throw new AppError(
          ErrorCode.MeetingAssistConsentRequired,
          'Consent is needed before the meeting assistant can read this meeting',
        );
      }
      const meeting = await deps.sessions.findDetail(userId, sessionId);
      if (!meeting) throw new AppError(ErrorCode.NotFound, 'Session not found');
      if (running.has(userId)) {
        throw new AppError(ErrorCode.Conflict, 'The assistant is still answering you');
      }
      const ticket = Symbol();
      running.set(userId, ticket);
      // Only this question's own lock: a later one may already be running.
      const release = () => {
        if (running.get(userId) === ticket) running.delete(userId);
      };

      let questionId: string;
      try {
        await deps.usage.reserve(userId, 'meeting_ask_daily');
        const created = await deps.repo.createQuestion(userId, sessionId, {
          question: request.question,
          promptVersion: MEETING_ASK_PROMPT_VERSION,
        });
        if (!created) throw new AppError(ErrorCode.NotFound, 'Session not found');
        questionId = created;
      } catch (error) {
        release();
        throw error;
      }

      const controller = new AbortController();
      const out = new Readable({
        read() {},
        // Fastify destroys the body when the client goes away: that is the person's "stop".
        destroy(error, callback) {
          controller.abort();
          // Free the person at once: they may ask again before the stopped answer is saved.
          release();
          callback(error);
        },
      });
      const write = (event: MeetingAskStreamEvent) => {
        if (!out.destroyed) out.push(frame(event));
      };

      let saved = false;
      let answer = '';
      let sources: MeetingAnswerSource[] = [];
      /** Stores the end state once and frees the person, before the client hears about it. */
      const finish = async (status: MeetingAnswerStatus): Promise<void> => {
        if (saved) return;
        saved = true;
        try {
          await deps.repo.finishQuestion(userId, questionId, {
            answer: stripSourceTags(answer).slice(0, MEETING_ANSWER_MAX),
            sources,
            status,
          });
        } catch {
          log?.warn({ sessionId, questionId }, 'meeting answer not saved');
        }
        release();
      };

      const pump = async (): Promise<void> => {
        const started = Date.now();
        let status: MeetingAnswerStatus = 'complete';
        try {
          write({ type: 'status', status: 'searching' });
          const context = await buildContext(
            {
              repo: deps.repo,
              listGlossary: deps.listGlossary,
              listPhrases: deps.listPhrases,
              now,
            },
            userId,
            meeting,
            request,
          );
          log?.info(
            {
              sessionId,
              questionId,
              retrievalMs: Date.now() - started,
              pastMeetings: context.input.past.length,
              pastFailed: context.pastFailed,
            },
            'meeting question context ready',
          );
          if (!controller.signal.aborted) {
            write({ type: 'status', status: 'answering' });
            for await (const part of deps.gateway!.ask(
              context.input,
              { userId, sessionId },
              controller.signal,
            )) {
              if (part.type !== 'text_delta') continue;
              answer += part.text;
              write({ type: 'text_delta', text: part.text });
            }
          }
          sources = citedSources(answer, context.available);
          if (controller.signal.aborted) status = 'stopped';
          else if (!answer.trim()) throw new Error('empty answer');
        } catch {
          status = controller.signal.aborted ? 'stopped' : 'error';
          if (status === 'error') {
            log?.warn({ sessionId, questionId }, 'meeting question failed');
            write({ type: 'error', code: ErrorCode.MeetingAssistFailed });
          }
        }
        await finish(status);
        if (status === 'complete') write({ type: 'sources', items: sources });
        write({ type: 'done', status, questionId });
        if (!out.destroyed) out.push(null);
      };
      void pump();
      return out;
    },
  };
}
