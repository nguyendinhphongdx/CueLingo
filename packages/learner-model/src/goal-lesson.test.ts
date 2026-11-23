import { describe, expect, it } from 'vitest';
import {
  defaultGoalLevel,
  goalLessonStatus,
  goalProgress,
  PASS_CORRECT,
  pickGoalNextUp,
  QUIZ_SIZE,
  quizRating,
  REPORTS_TO_RETIRE,
  scoreQuiz,
  shouldRetire,
} from './goal-lesson';

const results = (correct: number) => Array.from({ length: QUIZ_SIZE }, (_, i) => i < correct);

describe('scoreQuiz', () => {
  it('passes from 4 of 6 and not at 3', () => {
    expect(PASS_CORRECT).toBe(4);
    expect(scoreQuiz(results(3))).toEqual({ correct: 3, total: 6, passed: false });
    expect(scoreQuiz(results(4))).toEqual({ correct: 4, total: 6, passed: true });
    expect(scoreQuiz(results(6)).passed).toBe(true);
    expect(scoreQuiz(results(0)).passed).toBe(false);
  });
});

describe('quizRating', () => {
  it('rates a right answer good and a wrong one again', () => {
    expect(quizRating(true)).toBe(3);
    expect(quizRating(false)).toBe(1);
  });
});

describe('goalLessonStatus', () => {
  it('is todo before opening, learning once opened, done once passed', () => {
    expect(goalLessonStatus(undefined)).toBe('todo');
    expect(goalLessonStatus({ openedAt: new Date(), doneAt: null })).toBe('learning');
    expect(goalLessonStatus({ openedAt: new Date(), doneAt: new Date() })).toBe('done');
  });
});

describe('goalProgress', () => {
  it('rounds the share of lessons done', () => {
    const lessons = ['done', 'done', 'learning', 'todo', 'todo', 'todo'] as const;
    expect(goalProgress(lessons.map((status) => ({ status })))).toEqual({
      done: 2,
      total: 6,
      pct: 33,
    });
    expect(goalProgress([])).toEqual({ done: 0, total: 0, pct: 0 });
  });
});

describe('pickGoalNextUp', () => {
  const goal = (id: string, deadline: string | null, createdAt: string, done: number) => ({
    id,
    deadline,
    createdAt,
    lessons: Array.from({ length: 6 }, (_, i) => ({
      status: i < done ? ('done' as const) : ('todo' as const),
    })),
  });

  it('takes the nearest deadline, then goals without one, then the oldest', () => {
    const late = goal('late', '2026-12-20', '2026-11-01T00:00:00Z', 0);
    const soon = goal('soon', '2026-12-01', '2026-11-05T00:00:00Z', 2);
    const none = goal('none', null, '2026-10-01T00:00:00Z', 0);
    expect(pickGoalNextUp([none, late, soon])?.goal.id).toBe('soon');
    expect(pickGoalNextUp([none, late, soon])?.lessonIndex).toBe(2);
    expect(pickGoalNextUp([none, late])?.goal.id).toBe('late');
    const a = goal('a', null, '2026-11-02T00:00:00Z', 0);
    const b = goal('b', null, '2026-11-01T00:00:00Z', 0);
    expect(pickGoalNextUp([a, b])?.goal.id).toBe('b');
  });

  it('skips a finished goal and returns null when all are done', () => {
    const finished = goal('finished', '2026-12-01', '2026-11-01T00:00:00Z', 6);
    const open = goal('open', null, '2026-11-02T00:00:00Z', 1);
    expect(pickGoalNextUp([finished, open])?.goal.id).toBe('open');
    expect(pickGoalNextUp([finished])).toBeNull();
    expect(pickGoalNextUp([])).toBeNull();
  });
});

describe('defaultGoalLevel', () => {
  it('uses the listening level, else B1', () => {
    expect(defaultGoalLevel('a2')).toBe('a2');
    expect(defaultGoalLevel('c1')).toBe('c1');
    expect(defaultGoalLevel(null)).toBe('b1');
    expect(defaultGoalLevel(undefined)).toBe('b1');
    expect(defaultGoalLevel('x9')).toBe('b1');
  });
});

describe('shouldRetire', () => {
  it('retires at 3 different reports', () => {
    expect(REPORTS_TO_RETIRE).toBe(3);
    expect(shouldRetire(2)).toBe(false);
    expect(shouldRetire(3)).toBe(true);
  });
});
