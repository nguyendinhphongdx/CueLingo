import { describe, expect, it } from 'vitest';
import {
  buildLessons,
  courseProgress,
  COURSE_MAX_LESSONS,
  lessonStatus,
  orderPrepLessons,
  pickNextUp,
  type CourseSource,
} from './course';
import { newFsrsState, type FsrsState } from './fsrs';

const phrase = (text: string, meaning = 'nghĩa') => ({ phrase: text, meaningVi: meaning });
const source = (overrides: Partial<CourseSource> = {}): CourseSource => ({
  hardSegments: [],
  phraseSuggestions: [phrase('circle back'), phrase('touch base'), phrase('on the same page')],
  rephrase: [],
  ...overrides,
});

describe('buildLessons', () => {
  it('orders hard-segment phrases first, then debrief order, then better sentences', () => {
    const lessons = buildLessons(
      source({
        hardSegments: [{ id: 's1', text: 'Let us touch base on Friday.' }],
        rephrase: [{ better: 'Could you say that again?', noteVi: 'lịch sự hơn' }],
      }),
      [],
    );
    expect(lessons.map((lesson) => [lesson.phrase, lesson.origin])).toEqual([
      ['touch base', 'hard'],
      ['circle back', 'phrase'],
      ['on the same page', 'phrase'],
      ['could you say that again?', 'rephrase'],
    ]);
    expect(lessons[0]).toMatchObject({
      segmentId: 's1',
      contextEn: 'Let us touch base on Friday.',
    });
  });

  it('has no course below three lessons', () => {
    expect(buildLessons(source({ phraseSuggestions: [phrase('a b'), phrase('c d')] }), [])).toEqual(
      [],
    );
  });

  it('caps a course at ten lessons', () => {
    const many = Array.from({ length: 10 }, (_, index) => phrase(`phrase ${index}`));
    const lessons = buildLessons(
      source({ phraseSuggestions: many, rephrase: [{ better: 'one more', noteVi: 'x' }] }),
      [],
    );
    expect(lessons).toHaveLength(COURSE_MAX_LESSONS);
  });

  it('drops a lesson with no meaning and no sentence containing it, and duplicates', () => {
    const lessons = buildLessons(
      source({
        phraseSuggestions: [
          phrase('circle back'),
          phrase('Circle  back'),
          phrase('touch base'),
          phrase('on the same page'),
          { phrase: 'no meaning here', meaningVi: ' ' },
        ],
      }),
      [],
    );
    expect(lessons.map((lesson) => lesson.phrase)).toEqual([
      'circle back',
      'touch base',
      'on the same page',
    ]);
  });

  it('links a saved phrase to its item and keeps the saved meaning', () => {
    const lessons = buildLessons(source(), [
      { itemId: 'i1', phrase: 'circle back', meaningVi: 'đã lưu', contextEn: null },
    ]);
    expect(lessons[0]).toMatchObject({ itemId: 'i1', meaningVi: 'đã lưu' });
    expect(lessons[1]!.itemId).toBeNull();
  });
});

describe('lessonStatus', () => {
  const since = new Date('2026-11-21T00:00:00Z');
  const at = (hour: number, rating: number) => ({
    at: new Date(`2026-11-21T0${hour}:00:00Z`),
    rating,
  });

  it('is todo with no log since the debrief, ignoring older logs', () => {
    expect(lessonStatus([], since)).toBe('todo');
    expect(lessonStatus([{ at: new Date('2026-11-20T23:59:59Z'), rating: 4 }], since)).toBe('todo');
  });

  it('is learning below rating 3 and done from rating 3', () => {
    expect(lessonStatus([at(1, 2)], since)).toBe('learning');
    expect(lessonStatus([at(1, 1), at(2, 3)], since)).toBe('done');
    expect(lessonStatus([at(1, 4)], since)).toBe('done');
  });

  it('counts a log exactly at the debrief time and stays done after a later "again"', () => {
    expect(lessonStatus([{ at: since, rating: 3 }], since)).toBe('done');
    expect(lessonStatus([at(1, 3), at(2, 1)], since)).toBe('done');
  });
});

describe('courseProgress', () => {
  it('rounds the share of done lessons', () => {
    expect(courseProgress([])).toEqual({ done: 0, total: 0, pct: 0 });
    expect(courseProgress([{ status: 'todo' }, { status: 'learning' }]).pct).toBe(0);
    expect(courseProgress([{ status: 'done' }, { status: 'todo' }, { status: 'todo' }]).pct).toBe(
      33,
    );
    expect(courseProgress([{ status: 'done' }, { status: 'done' }])).toEqual({
      done: 2,
      total: 2,
      pct: 100,
    });
  });
});

describe('pickNextUp', () => {
  const course = (id: string, ...statuses: Array<'todo' | 'learning' | 'done'>) => ({
    id,
    lessons: statuses.map((status) => ({ status })),
  });

  it('prefers a started course and returns its first lesson not done', () => {
    const next = pickNextUp([course('new', 'todo', 'todo'), course('going', 'done', 'todo')]);
    expect(next).toMatchObject({ course: { id: 'going' }, lessonIndex: 1 });
  });

  it('falls back to the newest untouched course and skips finished ones', () => {
    expect(pickNextUp([course('a', 'done', 'done'), course('b', 'todo')])?.course.id).toBe('b');
    expect(pickNextUp([course('a', 'done')])).toBeNull();
    expect(pickNextUp([])).toBeNull();
  });
});

describe('orderPrepLessons', () => {
  const now = new Date('2026-11-21T00:00:00Z');
  const state = (due: string, lapses: number): FsrsState => ({
    ...newFsrsState(now),
    due,
    lapses,
  });

  it('puts the earliest due first, then the most lapses', () => {
    const ordered = orderPrepLessons(
      [
        { id: 'later', fsrs: state('2026-12-01T00:00:00Z', 0) },
        { id: 'old-few', fsrs: state('2026-11-01T00:00:00Z', 1) },
        { id: 'old-many', fsrs: state('2026-11-01T00:00:00Z', 4) },
        { id: 'new', fsrs: null },
      ],
      now,
    );
    expect(ordered.map((item) => item.id)).toEqual(['old-many', 'old-few', 'new', 'later']);
  });
});
