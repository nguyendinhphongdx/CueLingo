import type { LanguageCode } from '@cuelingo/shared';

/** Most meetings sent for one preparation; the API accepts at most this many ids. */
export const PREP_MAX_SESSIONS = 5;
/** A title shorter than this is too vague to match by "contains" ("1:1", "Sync"). */
const MIN_PARTIAL_LENGTH = 5;

export interface MatchableSession {
  id: string;
  title: string | null;
  startedAt: string;
  language: LanguageCode;
}

const normalise = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * Earlier meetings of the same language whose title matches the calendar title, newest first.
 * Runs on the device: the calendar title never reaches the server, only the ids that come out.
 */
export function matchSessions(
  calendarTitle: string,
  sessions: readonly MatchableSession[],
  language: LanguageCode,
): string[] {
  const wanted = normalise(calendarTitle);
  if (!wanted) return [];
  return sessions
    .filter((session) => {
      if (session.language !== language || !session.title) return false;
      const title = normalise(session.title);
      if (!title) return false;
      if (title === wanted) return true;
      const [short, long] = title.length <= wanted.length ? [title, wanted] : [wanted, title];
      return short.length >= MIN_PARTIAL_LENGTH && long.includes(short);
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, PREP_MAX_SESSIONS)
    .map((session) => session.id);
}
