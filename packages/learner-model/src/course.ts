import { normalizePhrase, type LessonOrigin, type LessonStatus } from '@cuelingo/shared';
import type { FsrsState } from './fsrs';

/** Course size and sitting length. Design: apps/docs/docs/04-modules/05-packages/learner-model.md */
export const COURSE_MIN_LESSONS = 3;
export const COURSE_MAX_LESSONS = 10;
/** Lessons offered per sitting (about 5 to 10 minutes). */
export const SITTING_SIZE = 5;
/** A review of this rating or higher (good, easy) finishes a lesson. */
export const DONE_RATING = 3;
/** Longest phrase the Phrase Bank accepts. */
const MAX_PHRASE_LENGTH = 200;

/** The parts of a debrief a course is made from; hard segments are resolved to their text. */
export interface CourseSource {
  hardSegments: ReadonlyArray<{ id: string; text: string }>;
  phraseSuggestions: ReadonlyArray<{ phrase: string; meaningVi: string; exampleEn?: string }>;
  rephrase: ReadonlyArray<{ better: string; noteVi?: string }>;
}

/** What the user already saved, by normalised phrase. */
export interface CourseLexiconEntry {
  itemId: string;
  phrase: string;
  meaningVi: string | null;
  contextEn: string | null;
}

/** A lesson before its status is known. `segmentId` is the hard segment that contains the phrase. */
export interface DraftLesson {
  phrase: string;
  itemId: string | null;
  meaningVi: string | null;
  contextEn: string | null;
  segmentId: string | null;
  origin: LessonOrigin;
}

const contains = (text: string | null | undefined, phrase: string): boolean =>
  Boolean(text) && normalizePhrase(text!).includes(phrase);

/**
 * Lessons of one meeting, in teaching order: phrases found in a hard segment, then the other
 * suggested phrases in debrief order, then the "better way to say it" sentences. A lesson needs a
 * meaning or a sentence that contains the phrase, or no exercise can be built from it.
 * Returns an empty list when fewer than `COURSE_MIN_LESSONS` remain: there is no course then.
 */
export function buildLessons(
  source: CourseSource,
  lexicon: ReadonlyArray<CourseLexiconEntry>,
): DraftLesson[] {
  const saved = new Map(lexicon.map((entry) => [entry.phrase, entry]));
  const seen = new Set<string>();
  const hard: DraftLesson[] = [];
  const phrases: DraftLesson[] = [];
  const sentences: DraftLesson[] = [];

  const add = (
    raw: string,
    meaningVi: string | null,
    example: string | null,
    origin: 'phrase' | 'rephrase',
  ) => {
    const phrase = normalizePhrase(raw.trim());
    if (!phrase || phrase.length > MAX_PHRASE_LENGTH || seen.has(phrase)) return;
    const segment = source.hardSegments.find((candidate) => contains(candidate.text, phrase));
    const entry = saved.get(phrase);
    const meaning = entry?.meaningVi ?? meaningVi;
    const context = entry?.contextEn ?? segment?.text ?? example;
    if (!meaning && !contains(context, phrase)) return;
    seen.add(phrase);
    const lesson: DraftLesson = {
      phrase,
      itemId: entry?.itemId ?? null,
      meaningVi: meaning,
      contextEn: contains(context, phrase) ? context : null,
      segmentId: segment?.id ?? null,
      origin: segment ? 'hard' : origin,
    };
    (segment ? hard : origin === 'phrase' ? phrases : sentences).push(lesson);
  };

  for (const item of source.phraseSuggestions) {
    add(item.phrase, item.meaningVi.trim() || null, item.exampleEn ?? null, 'phrase');
  }
  for (const item of source.rephrase)
    add(item.better, item.noteVi?.trim() || null, null, 'rephrase');

  const lessons = [...hard, ...phrases, ...sentences].slice(0, COURSE_MAX_LESSONS);
  return lessons.length >= COURSE_MIN_LESSONS ? lessons : [];
}

/**
 * Status of one lesson from the review logs of its item. Only logs at or after `since` (when the
 * debrief was made) count. Done is never undone by a later "again": FSRS keeps scheduling it.
 */
export function lessonStatus(
  logs: ReadonlyArray<{ at: Date; rating: number }>,
  since: Date,
): LessonStatus {
  const recent = logs.filter((log) => log.at.getTime() >= since.getTime());
  if (recent.length === 0) return 'todo';
  return recent.some((log) => log.rating >= DONE_RATING) ? 'done' : 'learning';
}

export interface CourseProgress {
  done: number;
  total: number;
  pct: number;
}

export function courseProgress(lessons: ReadonlyArray<{ status: LessonStatus }>): CourseProgress {
  const total = lessons.length;
  const done = lessons.filter((lesson) => lesson.status === 'done').length;
  return { done, total, pct: total === 0 ? 0 : Math.round((100 * done) / total) };
}

/**
 * The course to continue and its first lesson not done. A course already started and not finished
 * comes before one not started; ties keep the input order (newest meeting first).
 */
export function pickNextUp<T extends { lessons: ReadonlyArray<{ status: LessonStatus }> }>(
  courses: ReadonlyArray<T>,
): { course: T; lessonIndex: number } | null {
  const open = courses
    .map((course) => ({
      course,
      lessonIndex: course.lessons.findIndex((lesson) => lesson.status !== 'done'),
    }))
    .filter((entry) => entry.lessonIndex >= 0);
  const started = (entry: (typeof open)[number]) =>
    entry.course.lessons.some((lesson) => lesson.status !== 'todo');
  return open.find(started) ?? open[0] ?? null;
}

/** Preparation order: due earliest first (a phrase never reviewed counts as due now), then most lapses. */
export function orderPrepLessons<T extends { fsrs: FsrsState | null }>(
  items: ReadonlyArray<T>,
  now: Date,
): T[] {
  const dueAt = (item: T) => (item.fsrs ? Date.parse(item.fsrs.due) : now.getTime());
  return [...items].sort(
    (a, b) => dueAt(a) - dueAt(b) || (b.fsrs?.lapses ?? 0) - (a.fsrs?.lapses ?? 0),
  );
}
