import { createHash } from 'node:crypto';
import type { AiGateway } from '@cuelingo/ai-gateway';
import { DEFAULT_TTS_VOICE, ErrorCode, type TtsVoice } from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { TtsCache } from './tts.cache';

export type TtsService = ReturnType<typeof createTtsService>;

export interface TtsDeps {
  gateway: Pick<AiGateway, 'speech'>;
  cache: TtsCache;
  /** Fresh generations one person may start per minute; cache hits are free. */
  perMinute?: number;
  clock?: () => number;
  /** The voice the person chose in Settings; without it everyone hears the default. */
  getVoice?: (userId: string) => Promise<TtsVoice | null>;
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
/** The key has the voice but not the model, so a fallback model's audio is reused. Bump `v1` to start over. */
const keyOf = (voice: TtsVoice, text: string) =>
  createHash('sha256').update(`v1|${voice}|${text}`).digest('hex');

export function createTtsService({
  gateway,
  cache,
  perMinute = 20,
  clock = Date.now,
  getVoice,
}: TtsDeps) {
  const inFlight = new Map<string, Promise<Uint8Array>>();
  const recent = new Map<string, number[]>();

  function takeSlot(userId: string) {
    const now = clock();
    const times = (recent.get(userId) ?? []).filter((time) => now - time < 60_000);
    if (times.length >= perMinute) {
      throw new AppError(
        ErrorCode.RateLimited,
        'Too many new audio requests, try again in a minute',
      );
    }
    recent.set(userId, [...times, now]);
  }

  return {
    /**
     * Audio for `text`: from the cache, or generated once (concurrent requests share one generation).
     * `tryVoice` lets Settings play a voice before it is saved; otherwise the person's own voice is used.
     */
    async speak(userId: string, rawText: string, tryVoice?: TtsVoice) {
      const text = normalize(rawText);
      const voice = tryVoice ?? (await getVoice?.(userId)) ?? DEFAULT_TTS_VOICE;
      const key = keyOf(voice, text);

      const cached = await cache.get(key);
      if (cached) return { audio: cached, cache: 'hit' as const };

      let pending = inFlight.get(key);
      if (!pending) {
        takeSlot(userId);
        pending = gateway
          .speech(text, { voice }, { userId })
          .then(async (result) => {
            await cache.put(key, result.audio);
            return result.audio;
          })
          .finally(() => inFlight.delete(key));
        inFlight.set(key, pending);
      }

      try {
        return { audio: await pending, cache: 'miss' as const };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(ErrorCode.TtsFailed, 'Could not create the audio');
      }
    },
  };
}
