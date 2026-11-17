import { guessLanguageFromEvent, type LanguageCode } from '@cuelingo/shared';
import type { CalendarResult } from '../lib/native';

type CalendarEvent = NonNullable<CalendarResult['events']>[number];

/** How soon before a meeting the card appears. */
export const HINT_WINDOW_MS = 15 * 60_000;

export interface UpcomingMeeting {
  key: string;
  title: string;
  startMs: number;
  /** The language the entry points to, when it differs from the one in use; starting switches to it. */
  switchTo: LanguageCode | null;
}

/**
 * The first meeting that is on now or starts within 15 minutes and was not skipped. It is offered
 * whatever its language; `switchTo` is set only when the entry points to another one.
 */
export function pickUpcoming(
  events: readonly CalendarEvent[],
  now: number,
  current: LanguageCode,
  dismissed: ReadonlySet<string>,
): UpcomingMeeting | null {
  for (const event of events) {
    if (event.startMs - now > HINT_WINDOW_MS || event.endMs <= now) continue;
    const key = `${event.startMs}:${event.title}`;
    if (dismissed.has(key)) continue;
    const language = guessLanguageFromEvent(event);
    return {
      key,
      title: event.title,
      startMs: event.startMs,
      switchTo: language && language !== current ? language : null,
    };
  }
  return null;
}

/** "Còn 10 phút" before the start, "Đang diễn ra" after it. */
export function startsIn(startMs: number, now: number): string {
  const minutes = Math.ceil((startMs - now) / 60_000);
  return minutes <= 0 ? 'Đang diễn ra' : `Còn ${minutes} phút`;
}
