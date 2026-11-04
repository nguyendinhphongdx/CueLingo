import { wrapPcmAsWav, type AiGateway } from '@cuelingo/ai-gateway';
import {
  ErrorCode,
  SUPPORTED_LANGUAGES,
  type TranscribeRequest,
  type TranscribeResponse,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { SessionsRepository } from '../sessions';

/**
 * Old clients parse the response strictly, so `speaker` only goes back to a request that carried `knownSpeakers`.
 * A label that was not among the ones sent is treated as `unknown`; `new` keeps its hint.
 */
function withSpeaker(
  base: TranscribeResponse,
  input: TranscribeRequest,
  asked: TranscribeRequest['knownSpeakers'],
  result: { speaker?: { label: string; hint?: string } } | undefined,
): TranscribeResponse {
  if (input.knownSpeakers === undefined) return base;
  const guess = asked ? result?.speaker : undefined;
  if (guess?.label === 'new') {
    return {
      ...base,
      speaker: { label: 'new', ...(guess.hint ? { hint: guess.hint.slice(0, 60) } : {}) },
    };
  }
  const known = asked?.find((speaker) => speaker.label === guess?.label);
  return { ...base, speaker: { label: known?.label ?? 'unknown' } };
}

export type TranscribeService = ReturnType<typeof createTranscribeService>;

export interface TranscribeDeps {
  gateway: Pick<AiGateway, 'transcribe'>;
  /** Requests one person may start per `windowMs`. */
  maxRequests?: number;
  windowMs?: number;
  clock?: () => number;
}

const SAMPLE_RATE = 16_000;
const BYTES_PER_SECOND = SAMPLE_RATE * 2;
// The device caps an utterance at 25 s but may overshoot by a frame or a resampled block.
const MAX_SECONDS = 25.5;

export function createTranscribeService(
  sessions: Pick<SessionsRepository, 'findById'>,
  { gateway, maxRequests = 10, windowMs = 1_000, clock = Date.now }: TranscribeDeps,
) {
  // In memory and per process: it only has to stop one client from flooding the provider.
  const recent = new Map<string, number[]>();

  function takeSlot(userId: string) {
    const now = clock();
    const times = (recent.get(userId) ?? []).filter((time) => now - time < windowMs);
    if (times.length >= maxRequests) {
      recent.set(userId, times);
      throw new AppError(ErrorCode.RateLimited, 'Too many audio requests, slow down');
    }
    recent.set(userId, [...times, now]);
    // Drop people who went quiet so the map does not grow forever.
    if (recent.size > 1_000) {
      for (const [id, stamps] of recent) {
        if (stamps.every((time) => now - time >= windowMs)) recent.delete(id);
      }
    }
  }

  return {
    /** Audio of one utterance in, text out. The audio is held in memory for this call only. */
    async transcribe(
      userId: string,
      sessionId: string,
      input: TranscribeRequest,
    ): Promise<TranscribeResponse> {
      takeSlot(userId);

      const session = await sessions.findById(userId, sessionId);
      if (!session) throw new AppError(ErrorCode.NotFound, 'Session not found');
      if (SUPPORTED_LANGUAGES[session.language].recognition !== 'cloud') {
        throw new AppError(
          ErrorCode.LanguageNotCloud,
          'This meeting language is recognised on the device',
        );
      }

      const decoded = Buffer.from(input.pcm, 'base64');
      if (decoded.length > MAX_SECONDS * BYTES_PER_SECOND) {
        throw new AppError(ErrorCode.AudioTooLarge, `Audio is longer than ${MAX_SECONDS} seconds`);
      }
      // 16-bit samples: an odd byte count is not audio, so it is refused rather than trimmed.
      if (decoded.length % 2 !== 0) {
        throw new AppError(ErrorCode.Validation, 'Audio must be 16-bit samples');
      }
      const pcm = new Uint8Array(decoded.buffer, decoded.byteOffset, decoded.length);
      if (pcm.length === 0) {
        return withSpeaker({ segmentId: input.segmentId, text: '' }, input, undefined, undefined);
      }

      // Only the system stream of a language that tells speakers apart asks for labels; the registry decides.
      const labelling =
        input.stream === 'system' &&
        SUPPORTED_LANGUAGES[session.language].labelsSpeakers &&
        input.knownSpeakers !== undefined;
      const known = labelling ? input.knownSpeakers! : undefined;
      const request = {
        audio: wrapPcmAsWav(pcm, SAMPLE_RATE),
        language: session.language,
        previous: input.previous,
        ...(known ? { knownSpeakers: known } : {}),
      };

      try {
        const result = await gateway.transcribe(request, { userId, sessionId });
        return withSpeaker({ segmentId: input.segmentId, text: result.text }, input, known, result);
      } catch {
        // Nothing from the provider error is forwarded: it may carry what was said.
        throw new AppError(ErrorCode.TranscribeFailed, 'Could not transcribe the audio');
      }
    },
  };
}
