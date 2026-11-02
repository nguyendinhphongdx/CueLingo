import { guessLanguageFromEvent, type LanguageCode } from '@cuelingo/shared';
import type { CalendarResult } from '../lib/native';

export interface CalendarHint {
  /** Stable for one event, so dismissing it hides it for good. */
  key: string;
  title: string;
  startMs: number;
  language: LanguageCode;
}

type CalendarEvent = NonNullable<CalendarResult['events']>[number];

/** How soon before a meeting the suggestion appears. */
export const HINT_WINDOW_MS = 15 * 60_000;

/**
 * The first meeting that is on now or about to start and points to a language other than the one
 * in use. A dismissed meeting is not offered again.
 */
export function pickHint(
  events: readonly CalendarEvent[],
  now: number,
  current: LanguageCode,
  dismissed: ReadonlySet<string>,
): CalendarHint | null {
  for (const event of events) {
    if (event.startMs - now > HINT_WINDOW_MS || event.endMs <= now) continue;
    const key = `${event.startMs}:${event.title}`;
    if (dismissed.has(key)) continue;
    const language = guessLanguageFromEvent(event);
    if (language && language !== current) {
      return { key, title: event.title, startMs: event.startMs, language };
    }
  }
  return null;
}
