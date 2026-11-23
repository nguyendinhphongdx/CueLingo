import type { GoalLevel, LessonStatus } from '@cuelingo/shared';

/** Rules of goal lessons (ADR 0025). Pure: the API reads and writes, this decides. */

/** Questions in the quiz at the end of a lesson. */
export const QUIZ_SIZE = 6;
/** Right answers needed to finish a lesson (4 of 6, about 67%). */
export const PASS_CORRECT = 4;
/** Different people who report a content version before it is taken out. */
export const REPORTS_TO_RETIRE = 3;
/** FSRS ratings of one quiz answer: right is "good", wrong is "again". */
export const QUIZ_RIGHT_RATING = 3;
export const QUIZ_WRONG_RATING = 1;

export interface QuizScore {
  correct: number;
  total: number;
  passed: boolean;
}

/** One boolean per question, right or wrong. */
export function scoreQuiz(results: ReadonlyArray<boolean>): QuizScore {
  const correct = results.filter(Boolean).length;
  return { correct, total: results.length, passed: correct >= PASS_CORRECT };
}

export const quizRating = (correct: boolean): 1 | 3 =>
  correct ? QUIZ_RIGHT_RATING : QUIZ_WRONG_RATING;

/** Status of a lesson: not opened, opened, or passed. */
export function goalLessonStatus(
  lesson: { openedAt: Date | null; doneAt: Date | null } | undefined,
): LessonStatus {
  if (!lesson?.openedAt) return 'todo';
  return lesson.doneAt ? 'done' : 'learning';
}

export interface GoalProgress {
  done: number;
  total: number;
  pct: number;
}

export function goalProgress(lessons: ReadonlyArray<{ status: LessonStatus }>): GoalProgress {
  const total = lessons.length;
  const done = lessons.filter((lesson) => lesson.status === 'done').length;
  return { done, total, pct: total === 0 ? 0 : Math.round((100 * done) / total) };
}

export interface GoalForNextUp {
  deadline: string | null;
  createdAt: string;
  lessons: ReadonlyArray<{ status: LessonStatus }>;
}

/**
 * The goal to work on and its first lesson not done: the nearest deadline first, a goal without a deadline
 * after those with one, then the oldest goal. A goal with every lesson done is left out.
 */
export function pickGoalNextUp<T extends GoalForNextUp>(
  goals: ReadonlyArray<T>,
): { goal: T; lessonIndex: number } | null {
  const open = goals
    .map((goal) => ({
      goal,
      lessonIndex: goal.lessons.findIndex((lesson) => lesson.status !== 'done'),
    }))
    .filter((entry) => entry.lessonIndex >= 0);
  open.sort((a, b) => {
    const da = a.goal.deadline;
    const db = b.goal.deadline;
    if (da !== db) {
      if (da === null) return 1;
      if (db === null) return -1;
      return da.localeCompare(db);
    }
    return a.goal.createdAt.localeCompare(b.goal.createdAt);
  });
  return open[0] ?? null;
}

const LEVELS: ReadonlyArray<GoalLevel> = ['a2', 'b1', 'b2', 'c1'];

/** The level a new goal starts at: the listening level when there is one, else B1. */
export function defaultGoalLevel(listeningLevel: string | null | undefined): GoalLevel {
  return LEVELS.find((level) => level === listeningLevel) ?? 'b1';
}

/** True when enough different people reported one content version to take it out. */
export const shouldRetire = (distinctReports: number): boolean =>
  distinctReports >= REPORTS_TO_RETIRE;
