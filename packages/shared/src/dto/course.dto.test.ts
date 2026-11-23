import { describe, expect, it } from 'vitest';
import {
  CourseListSchema,
  CourseSchema,
  LessonStatusSchema,
  PrepCourseRequestSchema,
} from './course.dto';

const SESSION = '3f2b9a52-6a4e-4d1e-9a52-1f7a7a3b9c10';
const course = {
  sessionId: SESSION,
  headline: 'Họp sprint',
  startedAt: '2026-11-21T09:00:00.000Z',
  language: 'en',
  lessonCount: 3,
  doneCount: 1,
  progressPct: 33,
  unsavedCount: 0,
};

describe('course contract', () => {
  it('has the three lesson statuses', () => {
    expect(LessonStatusSchema.options).toEqual(['todo', 'learning', 'done']);
  });

  it('parses a course with lessons and a list with nextUp', () => {
    const lesson = {
      phrase: 'circle back',
      itemId: null,
      meaningVi: 'quay lại sau',
      status: 'todo',
      origin: 'phrase',
    };
    expect(CourseSchema.safeParse({ ...course, lessons: [lesson] }).success).toBe(true);
    expect(
      CourseListSchema.safeParse({
        courses: [course],
        nextUp: { sessionId: SESSION, headline: 'Họp sprint', phrase: 'circle back', saved: false },
      }).success,
    ).toBe(true);
  });

  it('rejects progress above 100', () => {
    expect(
      CourseListSchema.safeParse({ courses: [{ ...course, progressPct: 101 }], nextUp: null })
        .success,
    ).toBe(false);
  });

  it('accepts one to five session ids for preparation and rejects more', () => {
    expect(PrepCourseRequestSchema.safeParse({ sessionIds: [SESSION] }).success).toBe(true);
    expect(PrepCourseRequestSchema.safeParse({ sessionIds: [] }).success).toBe(false);
    expect(PrepCourseRequestSchema.safeParse({ sessionIds: Array(6).fill(SESSION) }).success).toBe(
      false,
    );
  });
});
