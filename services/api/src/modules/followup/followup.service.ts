import type { AiGateway } from '@cuelingo/ai-gateway';
import { checkFollowupOutput, FollowupOutputSchema } from '@cuelingo/prompts';
import {
  ErrorCode,
  type FollowupRequest,
  type FollowupResponse,
  type LanguageCode,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { DebriefRepository } from '../debrief';
import type { SessionsRepository } from '../sessions';

const MAX_TRACKED_USERS = 5_000;

const GENERIC_SUBJECT: Record<LanguageCode, string> = {
  en: 'Follow-up: meeting summary',
  ja: '会議のフォローアップ',
  ko: '회의 후속 조치',
  zh: '会议跟进',
  vi: 'Tóm tắt cuộc họp',
};

/** The headline only for Vietnamese meetings (it is Vietnamese text); a generic subject otherwise. */
function fallbackSubject(language: LanguageCode, headlineVi: string): string {
  const headline = headlineVi.replace(/\s+/g, ' ').trim().slice(0, 200);
  return language === 'vi' && headline ? headline : GENERIC_SUBJECT[language];
}

export type FollowupService = ReturnType<typeof createFollowupService>;

export interface FollowupDeps {
  gateway: Pick<AiGateway, 'json'>;
  /** Drafts one person may ask for per `windowMs`. */
  maxRequests?: number;
  windowMs?: number;
  clock?: () => number;
}

export function createFollowupService(
  sessions: Pick<SessionsRepository, 'findById'>,
  debriefs: Pick<DebriefRepository, 'findLatest'>,
  { gateway, maxRequests = 6, windowMs = 60_000, clock = Date.now }: FollowupDeps,
) {
  // In memory and per process: it only has to stop one account from using this as free text generation.
  // Capped, and expired entries are swept at most once per window, never on every request.
  const recent = new Map<string, number[]>();
  let lastSweep = clock();

  function takeSlot(userId: string) {
    const now = clock();
    if (now - lastSweep >= windowMs) {
      lastSweep = now;
      for (const [id, stamps] of recent) {
        if (stamps.every((time) => now - time >= windowMs)) recent.delete(id);
      }
    }
    const times = (recent.get(userId) ?? []).filter((time) => now - time < windowMs);
    if (times.length >= maxRequests) {
      recent.set(userId, times);
      throw new AppError(ErrorCode.RateLimited, 'Too many follow-up requests, slow down');
    }
    // Re-insert so the map stays ordered by last use; the oldest user goes first when full.
    recent.delete(userId);
    recent.set(userId, [...times, now]);
    if (recent.size > MAX_TRACKED_USERS) recent.delete(recent.keys().next().value!);
  }

  return {
    /** Drafts a message from the caller's latest debrief for the session. Nothing is stored. */
    async draft(
      userId: string,
      sessionId: string,
      { channel, tone }: FollowupRequest,
    ): Promise<FollowupResponse> {
      const session = await sessions.findById(userId, sessionId);
      const debrief = session ? await debriefs.findLatest(userId, sessionId) : null;
      // One message for both cases so the answer does not reveal whether the session exists.
      if (!session || !debrief) throw new AppError(ErrorCode.NotFound, 'Debrief not found');
      // After the lookup: a prober or a pending debrief does not use up the caller's slots.
      takeSlot(userId);

      const draftOnce = () =>
        gateway.json(
          'assist.followup',
          {
            debrief: { summary: debrief.summary, actionItems: debrief.actionItems },
            language: session.language,
            channel,
            tone,
          },
          FollowupOutputSchema,
          { userId, sessionId },
        );

      // One retry when the draft breaks a rule; the second failure is final.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        let output;
        try {
          output = await draftOnce();
        } catch {
          // Nothing from the provider error is forwarded: it may carry the debrief or the draft.
          throw new AppError(ErrorCode.FollowupFailed, 'Could not draft the follow-up');
        }
        // An email without a subject is not worth a second call: the subject is filled in below.
        const check = checkFollowupOutput(channel, output);
        const fixable =
          !check.ok &&
          (check.reason === 'email-without-subject' || check.reason === 'chat-has-subject');
        if (check.ok || fixable) {
          return {
            subject:
              channel === 'chat'
                ? null
                : output.subject?.trim() ||
                  fallbackSubject(session.language, debrief.summary.headlineVi),
            body: output.body,
            language: session.language,
          };
        }
      }
      throw new AppError(ErrorCode.FollowupFailed, 'Could not draft the follow-up');
    },
  };
}
