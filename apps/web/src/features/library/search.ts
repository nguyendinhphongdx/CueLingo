import type { Session, SessionDetail } from '@cuelingo/shared';
import { speakerDisplayName } from '@cuelingo/ui/lib/speaker';

/** Longest part of a line shown around a match. */
const SNIPPET_RADIUS = 48;
/** Most lines shown for one meeting. */
export const MAX_SNIPPETS = 3;
/** How many of the newest meetings are read for text; the list has no search endpoint, so each is one request. */
export const SEARCH_SCOPE = 30;
/** Shorter text matches almost everything. */
export const MIN_QUERY_LENGTH = 2;

export interface Snippet {
  segmentId: string;
  /** Who said it, as shown to the person. */
  speaker: string;
  text: string;
}

export interface TextPart {
  text: string;
  match: boolean;
}

const fold = (value: string) => value.normalize('NFC').toLowerCase();

export const isSearching = (query: string) => query.trim().length >= MIN_QUERY_LENGTH;

/** `YYYY-MM` in Vietnam time (UTC+7), the key of the month filter. */
export function monthKey(iso: string): string {
  return new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 7);
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  return `Tháng ${Number(month)}/${year}`;
}

/** The months that have a meeting, newest first. */
export function monthsOf(sessions: Pick<Session, 'startedAt'>[]): string[] {
  return [...new Set(sessions.map((session) => monthKey(session.startedAt)))].sort().reverse();
}

/** Splits `text` so the parts equal to `query` (ignoring case) can be marked. */
export function highlight(text: string, query: string): TextPart[] {
  const needle = fold(query.trim());
  if (!needle) return [{ text, match: false }];
  const haystack = fold(text);
  // Folding can change the length of rare characters; then show the text unmarked rather than mis-marked.
  if (haystack.length !== text.length) return [{ text, match: false }];
  const parts: TextPart[] = [];
  let from = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    from = at + needle.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts.length ? parts : [{ text, match: false }];
}

function around(text: string, query: string): string {
  const at = fold(text).indexOf(fold(query.trim()));
  if (at <= SNIPPET_RADIUS)
    return text.length > SNIPPET_RADIUS * 3 ? `${text.slice(0, SNIPPET_RADIUS * 3)}…` : text;
  const end = at + query.trim().length + SNIPPET_RADIUS;
  return `…${text.slice(at - SNIPPET_RADIUS, end)}${end < text.length ? '…' : ''}`;
}

function speakerOf(detail: SessionDetail, segment: SessionDetail['segments'][number]): string {
  const speaker = detail.speakers.find((item) => item.id === segment.speakerId);
  return speakerDisplayName({
    label: speaker?.label ?? null,
    displayName: speaker?.displayName ?? null,
    source: segment.source,
  });
}

/** The names of the people who spoke in a meeting. */
export function speakersOf(detail: SessionDetail): string[] {
  return [...new Set(detail.segments.map((segment) => speakerOf(detail, segment)))];
}

/** Lines of a meeting that contain `query` (English or Vietnamese), optionally only from one speaker. */
export function findSnippets(detail: SessionDetail, query: string, speaker?: string): Snippet[] {
  const needle = fold(query.trim());
  if (!needle) return [];
  const found: Snippet[] = [];
  for (const segment of detail.segments) {
    const who = speakerOf(detail, segment);
    if (speaker && who !== speaker) continue;
    const text = [segment.textEn, segment.textVi].find(
      (candidate) => candidate && fold(candidate).includes(needle),
    );
    if (text) found.push({ segmentId: segment.id, speaker: who, text: around(text, query) });
  }
  return found;
}

export interface SearchFilters {
  query: string;
  /** `YYYY-MM`, or empty for every month. */
  month: string;
  /** Display name of a speaker, or empty for anyone. */
  speaker: string;
}

export interface SessionHit {
  session: Session;
  snippets: Snippet[];
}

/**
 * The meetings that pass the filters. `details` holds the meetings whose text has been read so far; a meeting
 * whose text is missing still matches by title.
 */
export function searchSessions(
  sessions: Session[],
  details: ReadonlyMap<string, SessionDetail>,
  { query, month, speaker }: SearchFilters,
): SessionHit[] {
  const searching = isSearching(query);
  const needle = fold(query.trim());
  const hits: SessionHit[] = [];
  for (const session of sessions) {
    if (month && monthKey(session.startedAt) !== month) continue;
    const detail = details.get(session.id);
    if (speaker && !(detail && speakersOf(detail).includes(speaker))) continue;
    const snippets = detail && searching ? findSnippets(detail, query, speaker || undefined) : [];
    if (searching) {
      const titled = fold(session.title ?? '').includes(needle);
      if (!titled && snippets.length === 0) continue;
    }
    hits.push({ session, snippets: snippets.slice(0, MAX_SNIPPETS) });
  }
  return hits;
}
