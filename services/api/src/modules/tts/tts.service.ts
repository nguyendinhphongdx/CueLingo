import { createHash } from 'node:crypto';
import type { AiGateway } from '@cuelingo/ai-gateway';
import { ErrorCode } from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { TtsCache } from './tts.cache';

export type TtsService = ReturnType<typeof createTtsService>;

export interface TtsDeps {
  gateway: Pick<AiGateway, 'speech'>;
  cache: TtsCache;
  /** Fresh generations one person may start per minute; cache hits are free. */
  perMinute?: number;
  clock?: () => number;
}

const VOICE = 'Kore';
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
/** The key does not include the model, so a fallback model's audio is reused. Bump `v1` to start over. */
const keyOf = (text: string) => createHash('sha256').update(`v1|${VOICE}|${text}`).digest('hex');

export function createTtsService({ gateway, cache, perMinute = 20, clock = Date.now }: TtsDeps) {
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
    /** Audio for `text`: from the cache, or generated once (concurrent requests share one generation). */
    async speak(userId: string, rawText: string) {
      const text = normalize(rawText);
      const key = keyOf(text);

      const cached = await cache.get(key);
      if (cached) return { audio: cached, cache: 'hit' as const };

      let pending = inFlight.get(key);
      if (!pending) {
        takeSlot(userId);
        pending = gateway
          .speech(text, { voice: VOICE }, { userId })
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
