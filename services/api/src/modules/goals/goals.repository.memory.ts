import { randomUUID } from 'node:crypto';
import type { GoalLanguage, LessonPersonal, LessonReportReason } from '@cuelingo/shared';
import type { GoalLessonRow, GoalRow, GoalsRepository, LessonContentRow } from './goals.repository';

export interface InMemoryGoalsRepository extends GoalsRepository {
  /** What `learner_languages` holds in Postgres. */
  seedListeningLevel(userId: string, language: GoalLanguage, level: string): void;
  /** Shared content rows, for tests that check what was stored. */
  contents(): LessonContentRow[];
  /** All personal rows of one person, for tests that check what a deletion leaves. */
  reportsOf(contentId: string): Array<{ userId: string; reason: LessonReportReason }>;
}

/** In-memory implementation with the same user boundaries as Postgres, for tests and local demos. */
export function createInMemoryGoalsRepository(): InMemoryGoalsRepository {
  const goals: Array<GoalRow & { userId: string }> = [];
  const lessons: Array<GoalLessonRow & { userId: string; personalVersion: string | null }> = [];
  const contents: LessonContentRow[] = [];
  const reports: Array<{ contentId: string; userId: string; reason: LessonReportReason }> = [];
  const levels = new Map<string, string>();

  const strip = ({ userId: _userId, ...goal }: GoalRow & { userId: string }): GoalRow => goal;
  const stripLesson = ({
    userId: _userId,
    personalVersion: _personalVersion,
    ...lesson
  }: GoalLessonRow & { userId: string; personalVersion: string | null }): GoalLessonRow => lesson;
  const ownGoal = (userId: string, id: string) =>
    goals.find((goal) => goal.userId === userId && goal.id === id);
  const live = (goalKey: string, lessonKey: string, level: string, language: string) =>
    contents.find(
      (row) =>
        row.goalKey === goalKey &&
        row.lessonKey === lessonKey &&
        row.level === level &&
        row.language === language &&
        row.status === 'live',
    );

  return {
    seedListeningLevel(userId, language, level) {
      levels.set(`${userId}:${language}`, level);
    },
    contents: () => contents.map((row) => ({ ...row })),
    reportsOf: (contentId) =>
      reports
        .filter((report) => report.contentId === contentId)
        .map(({ userId, reason }) => ({ userId, reason })),

    async listGoals(userId) {
      return goals
        .filter((goal) => goal.userId === userId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(strip);
    },
    async findGoal(userId, id) {
      const goal = ownGoal(userId, id);
      return goal ? strip(goal) : null;
    },
    async createGoal(userId, input) {
      if (
        goals.some(
          (goal) =>
            goal.userId === userId &&
            goal.goalKey === input.goalKey &&
            goal.language === input.language,
        )
      )
        return null;
      const goal = { ...input, id: randomUUID(), createdAt: new Date(), userId };
      goals.push(goal);
      return strip(goal);
    },
    async updateGoal(userId, id, patch) {
      const goal = ownGoal(userId, id);
      if (!goal) return null;
      if (patch.level) goal.level = patch.level;
      if (patch.deadline !== undefined) goal.deadline = patch.deadline;
      return strip(goal);
    },
    async deleteGoal(userId, id) {
      const index = goals.findIndex((goal) => goal.userId === userId && goal.id === id);
      if (index === -1) return false;
      goals.splice(index, 1);
      for (let i = lessons.length - 1; i >= 0; i -= 1)
        if (lessons[i]!.goalId === id) lessons.splice(i, 1);
      return true;
    },
    async listLessons(userId, goalIds) {
      return lessons
        .filter((lesson) => lesson.userId === userId && goalIds.includes(lesson.goalId))
        .map(stripLesson);
    },
    async findLesson(userId, goalId, lessonKey) {
      const lesson = lessons.find(
        (row) => row.userId === userId && row.goalId === goalId && row.lessonKey === lessonKey,
      );
      return lesson ? stripLesson(lesson) : null;
    },
    async listeningLevel(userId, language) {
      return levels.get(`${userId}:${language}`) ?? null;
    },

    async findLiveContent(goalKey, lessonKey, level, language) {
      const row = live(goalKey, lessonKey, level, language);
      return row ? { ...row } : null;
    },
    async findContent(id) {
      const row = contents.find((candidate) => candidate.id === id);
      return row ? { ...row } : null;
    },
    async insertContent(input) {
      const existing = live(input.goalKey, input.lessonKey, input.level, input.language);
      if (existing) return { ...existing };
      const revision =
        1 +
        Math.max(
          0,
          ...contents
            .filter(
              (row) =>
                row.goalKey === input.goalKey &&
                row.lessonKey === input.lessonKey &&
                row.level === input.level &&
                row.language === input.language,
            )
            .map((row) => row.revision),
        );
      const row: LessonContentRow = { ...input, id: randomUUID(), revision, status: 'live' };
      contents.push(row);
      return { ...row };
    },
    async retireContent(id) {
      const row = contents.find((candidate) => candidate.id === id);
      if (row) row.status = 'retired';
    },

    async pinLesson(userId, goalId, lessonKey, contentId) {
      if (!ownGoal(userId, goalId)) return null;
      let lesson = lessons.find((row) => row.goalId === goalId && row.lessonKey === lessonKey);
      if (!lesson) {
        lesson = {
          goalId,
          lessonKey,
          contentId,
          personal: null,
          personalVersion: null,
          bestCorrect: null,
          attempts: 0,
          doneAt: null,
          openedAt: new Date(),
          userId,
        };
        lessons.push(lesson);
      }
      return stripLesson(lesson);
    },
    async setPersonal(userId, goalId, lessonKey, personal: LessonPersonal, promptVersion) {
      const lesson = lessons.find(
        (row) => row.userId === userId && row.goalId === goalId && row.lessonKey === lessonKey,
      );
      if (!lesson || lesson.personal !== null) return false;
      lesson.personal = personal;
      lesson.personalVersion = promptVersion;
      return true;
    },
    async recordQuiz(userId, goalId, lessonKey, record) {
      const lesson = lessons.find(
        (row) => row.userId === userId && row.goalId === goalId && row.lessonKey === lessonKey,
      );
      if (!lesson) return null;
      lesson.attempts += 1;
      lesson.bestCorrect = Math.max(lesson.bestCorrect ?? 0, record.correct);
      if (record.passed) lesson.doneAt ??= record.at;
      return stripLesson(lesson);
    },
    async addReport(userId, contentId, reason) {
      const existing = reports.find(
        (report) => report.contentId === contentId && report.userId === userId,
      );
      if (existing) existing.reason = reason;
      else reports.push({ contentId, userId, reason });
      return reports.filter((report) => report.contentId === contentId).length;
    },
  };
}
