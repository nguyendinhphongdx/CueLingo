import { useEffect, useState } from 'react';
import type { TranscriptEvent } from '../lib/native';

export type LiveStatus = 'waiting' | 'listening' | 'quiet';

/** How long after the last caption update the overlay still counts as "listening". */
const ACTIVE_WINDOW_MS = 6_000;

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
  return now - lastAt < ACTIVE_WINDOW_MS ? 'listening' : 'quiet';
}
