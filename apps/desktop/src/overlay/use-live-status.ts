import { isLanguageCode, SUPPORTED_LANGUAGES } from '@cuelingo/shared';
import { useEffect, useState } from 'react';
import type { TranscriptEvent } from '../lib/native';

export type LiveStatus = 'waiting' | 'listening' | 'quiet';

/** How long after the last caption update the overlay still counts as "listening". */
const ACTIVE_WINDOW_MS = 6_000;
/**
 * Cloud recognition returns a caption only once a sentence has ended and its audio has been recognised, and a
 * sentence can run to 25 s, so captions arrive further apart than on-device ones.
 */
const CLOUD_ACTIVE_WINDOW_MS = 25_000;

/** The pause after which the meeting counts as quiet, by how the meeting's language is recognised. */
export function activeWindowMs(segments: TranscriptEvent[]): number {
  const language = segments[segments.length - 1]?.language;
  return isLanguageCode(language) && SUPPORTED_LANGUAGES[language].recognition === 'cloud'
    ? CLOUD_ACTIVE_WINDOW_MS
    : ACTIVE_WINDOW_MS;
}

/**
 * Tells whether speech is coming in: `waiting` before the first caption, `listening` while captions keep
 * arriving, `quiet` after a pause.
 */
export function useLiveStatus(segments: TranscriptEvent[], received: boolean): LiveStatus {
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (received && segments.length > 0) setLastAt(Date.now());
  }, [segments, received]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!received || lastAt === null) return 'waiting';
  return now - lastAt < activeWindowMs(segments) ? 'listening' : 'quiet';
}
