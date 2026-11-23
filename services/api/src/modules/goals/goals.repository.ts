import type {
  GoalLanguage,
  GoalLevel,
  LessonContent,
  LessonPersonal,
  LessonReportReason,
} from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

export interface GoalRow {
  id: string;
  goalKey: string;
  language: GoalLanguage;
  level: GoalLevel;
  /** `YYYY-MM-DD` or null. */
  deadline: string | null;
  createdAt: Date;
}

/** What one person did with one lesson: the pinned content, the personal part and the quiz result. */
export interface GoalLessonRow {
  goalId: string;
  lessonKey: string;
  contentId: string;
  personal: LessonPersonal | null;
  bestCorrect: number | null;
  attempts: number;
  doneAt: Date | null;
  openedAt: Date;
}

/** Shared content: no user in it (ADR 0025). */
export interface LessonContentRow {
  id: string;
  goalKey: string;
  lessonKey: string;
  level: GoalLevel;
  language: GoalLanguage;
  revision: number;
  promptVersion: string;
  model: string;
  content: LessonContent;
  status: 'live' | 'retired';
}

export interface NewLessonContent {
  goalKey: string;
  lessonKey: string;
  level: GoalLevel;
  language: GoalLanguage;
  promptVersion: string;
  model: string;
  content: LessonContent;
}

export interface QuizRecord {
  correct: number;
  passed: boolean;
  at: Date;
}

/**
 * Data access for goals and goal lessons. Every method that touches a person's rows takes the
 * authenticated user's id and filters on it. `lesson_contents` is shared and has no user.
 */
export interface GoalsRepository {
  listGoals(userId: string): Promise<GoalRow[]>;
  findGoal(userId: string, id: string): Promise<GoalRow | null>;
  /** Null when the person already has this goal (the unique index decides, so two requests cannot both win). */
  createGoal(
    userId: string,
    input: { goalKey: string; language: GoalLanguage; level: GoalLevel; deadline: string | null },
  ): Promise<GoalRow | null>;
  updateGoal(
    userId: string,
    id: string,
    patch: { level?: GoalLevel; deadline?: string | null },
  ): Promise<GoalRow | null>;
  deleteGoal(userId: string, id: string): Promise<boolean>;
  /** The lesson rows of these goals (only the ones the person opened). */
  listLessons(userId: string, goalIds: string[]): Promise<GoalLessonRow[]>;
  findLesson(userId: string, goalId: string, lessonKey: string): Promise<GoalLessonRow | null>;
  /** The listening level the person has for a language, from the placement test. */
  listeningLevel(userId: string, language: GoalLanguage): Promise<string | null>;

  findLiveContent(
    goalKey: string,
    lessonKey: string,
    level: GoalLevel,
    language: GoalLanguage,
  ): Promise<LessonContentRow | null>;
  findContent(id: string): Promise<LessonContentRow | null>;
  /**
   * Stores a new live version; when one already won the race, returns that one instead.
   * Null only when the winner kept disappearing (retired) during three tries.
   */
  insertContent(input: NewLessonContent): Promise<LessonContentRow | null>;
  retireContent(id: string): Promise<void>;

  /** Pins the content to the person's lesson; keeps the first pin when one exists. Null: not the person's goal. */
  pinLesson(
    userId: string,
    goalId: string,
    lessonKey: string,
    contentId: string,
  ): Promise<GoalLessonRow | null>;
  /** True only for the request that wrote the personal part (it was still empty): that one counts the lesson. */
  setPersonal(
    userId: string,
    goalId: string,
    lessonKey: string,
    personal: LessonPersonal,
    promptVersion: string | null,
  ): Promise<boolean>;
  recordQuiz(
    userId: string,
    goalId: string,
    lessonKey: string,
    record: QuizRecord,
  ): Promise<GoalLessonRow | null>;
  /** Stores one report per person and content version; returns how many different people reported it. */
  addReport(userId: string, contentId: string, reason: LessonReportReason): Promise<number>;
}

interface GoalDbRow {
  id: string;
  goal_key: string;
  language: GoalLanguage;
  level: GoalLevel;
  deadline: string | null;
  created_at: Date;
}

interface LessonDbRow {
  goal_id: string;
  lesson_key: string;
  content_id: string;
  personal: LessonPersonal | null;
  best_correct: number | null;
  attempts: number;
  done_at: Date | null;
  opened_at: Date;
}

interface ContentDbRow {
  id: string;
  goal_key: string;
  lesson_key: string;
  level: GoalLevel;
  language: GoalLanguage;
  revision: number;
  prompt_version: string;
  model: string;
  content: LessonContent;
  status: 'live' | 'retired';
}

const GOAL_COLUMNS = (sql: Sql) =>
  sql`id, goal_key, language, level, deadline::text AS deadline, created_at`;
const CONTENT_COLUMNS = (sql: Sql) =>
  sql`id, goal_key, lesson_key, level, language, revision, prompt_version, model, content, status`;

const toGoal = (row: GoalDbRow): GoalRow => ({
  id: row.id,
  goalKey: row.goal_key,
  language: row.language,
  level: row.level,
  deadline: row.deadline,
  createdAt: row.created_at,
});

const toLesson = (row: LessonDbRow): GoalLessonRow => ({
  goalId: row.goal_id,
  lessonKey: row.lesson_key,
  contentId: row.content_id,
  personal: row.personal,
  bestCorrect: row.best_correct,
  attempts: row.attempts,
  doneAt: row.done_at,
  openedAt: row.opened_at,
});

const toContent = (row: ContentDbRow): LessonContentRow => ({
  id: row.id,
  goalKey: row.goal_key,
  lessonKey: row.lesson_key,
  level: row.level,
  language: row.language,
  revision: row.revision,
  promptVersion: row.prompt_version,
  model: row.model,
  content: row.content,
  status: row.status,
});

export function createPostgresGoalsRepository(sql: Sql): GoalsRepository {
  return {
    async listGoals(userId) {
      const rows = await sql<GoalDbRow[]>`
        SELECT ${GOAL_COLUMNS(sql)} FROM learning_goals
        WHERE user_id = ${userId} ORDER BY created_at, id`;
      return rows.map(toGoal);
    },

    async findGoal(userId, id) {
      const [row] = await sql<GoalDbRow[]>`
        SELECT ${GOAL_COLUMNS(sql)} FROM learning_goals
        WHERE user_id = ${userId} AND id = ${id}`;
      return row ? toGoal(row) : null;
    },

    async createGoal(userId, input) {
      const [row] = await sql<GoalDbRow[]>`
        INSERT INTO learning_goals (user_id, goal_key, language, level, deadline)
        VALUES (${userId}, ${input.goalKey}, ${input.language}, ${input.level}, ${input.deadline})
        ON CONFLICT (user_id, goal_key, language) DO NOTHING
        RETURNING ${GOAL_COLUMNS(sql)}`;
      return row ? toGoal(row) : null;
    },

    async updateGoal(userId, id, patch) {
      const [row] = await sql<GoalDbRow[]>`
        UPDATE learning_goals SET
          level = COALESCE(${patch.level ?? null}, level),
          deadline = CASE WHEN ${patch.deadline !== undefined} THEN ${patch.deadline ?? null}::date ELSE deadline END
        WHERE user_id = ${userId} AND id = ${id}
        RETURNING ${GOAL_COLUMNS(sql)}`;
      return row ? toGoal(row) : null;
    },

    async deleteGoal(userId, id) {
      const result = await sql`DELETE FROM learning_goals WHERE user_id = ${userId} AND id = ${id}`;
      return result.count > 0;
    },

    async listLessons(userId, goalIds) {
      if (goalIds.length === 0) return [];
      const rows = await sql<LessonDbRow[]>`
        SELECT goal_id, lesson_key, content_id, personal, best_correct, attempts, done_at, opened_at
        FROM goal_lessons
        WHERE user_id = ${userId} AND goal_id = ANY(${goalIds}::uuid[])`;
      return rows.map(toLesson);
    },

    async findLesson(userId, goalId, lessonKey) {
      const [row] = await sql<LessonDbRow[]>`
        SELECT goal_id, lesson_key, content_id, personal, best_correct, attempts, done_at, opened_at
        FROM goal_lessons
        WHERE user_id = ${userId} AND goal_id = ${goalId} AND lesson_key = ${lessonKey}`;
      return row ? toLesson(row) : null;
    },

    async listeningLevel(userId, language) {
      const [row] = await sql<{ listening_level: string | null }[]>`
        SELECT listening_level FROM learner_languages
        WHERE user_id = ${userId} AND language = ${language}`;
      return row?.listening_level ?? null;
    },

    async findLiveContent(goalKey, lessonKey, level, language) {
      const [row] = await sql<ContentDbRow[]>`
        SELECT ${CONTENT_COLUMNS(sql)} FROM lesson_contents
        WHERE goal_key = ${goalKey} AND lesson_key = ${lessonKey} AND level = ${level}
          AND language = ${language} AND status = 'live'`;
      return row ? toContent(row) : null;
    },

    async findContent(id) {
      const [row] = await sql<ContentDbRow[]>`
        SELECT ${CONTENT_COLUMNS(sql)} FROM lesson_contents WHERE id = ${id}`;
      return row ? toContent(row) : null;
    },

    async insertContent(input) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const [inserted] = await sql<ContentDbRow[]>`
        INSERT INTO lesson_contents
          (goal_key, lesson_key, level, language, revision, prompt_version, model, content)
        VALUES (
          ${input.goalKey}, ${input.lessonKey}, ${input.level}, ${input.language},
          (SELECT COALESCE(max(revision), 0) + 1 FROM lesson_contents
            WHERE goal_key = ${input.goalKey} AND lesson_key = ${input.lessonKey}
              AND level = ${input.level} AND language = ${input.language}),
          ${input.promptVersion}, ${input.model}, ${sql.json(input.content)}
        )
        ON CONFLICT (goal_key, lesson_key, level, language) WHERE status = 'live' DO NOTHING
        RETURNING ${CONTENT_COLUMNS(sql)}`;
        if (inserted) return toContent(inserted);
        const [winner] = await sql<ContentDbRow[]>`
        SELECT ${CONTENT_COLUMNS(sql)} FROM lesson_contents
        WHERE goal_key = ${input.goalKey} AND lesson_key = ${input.lessonKey} AND level = ${input.level}
          AND language = ${input.language} AND status = 'live'`;
        // The winner was retired between the two statements: try the insert again, a few times.
        if (winner) return toContent(winner);
      }
      return null;
    },

    async retireContent(id) {
      await sql`UPDATE lesson_contents SET status = 'retired' WHERE id = ${id}`;
    },

    async pinLesson(userId, goalId, lessonKey, contentId) {
      // The goal must be the person's own: the insert selects it by user.
      await sql`
        INSERT INTO goal_lessons (goal_id, user_id, lesson_key, content_id)
        SELECT id, user_id, ${lessonKey}, ${contentId} FROM learning_goals
        WHERE id = ${goalId} AND user_id = ${userId}
        ON CONFLICT (goal_id, lesson_key) DO NOTHING`;
      const [row] = await sql<LessonDbRow[]>`
        SELECT goal_id, lesson_key, content_id, personal, best_correct, attempts, done_at, opened_at
        FROM goal_lessons
        WHERE user_id = ${userId} AND goal_id = ${goalId} AND lesson_key = ${lessonKey}`;
      // No row: the goal is not the person's (or was deleted a moment ago).
      return row ? toLesson(row) : null;
    },

    async setPersonal(userId, goalId, lessonKey, personal, promptVersion) {
      const rows = await sql`
        UPDATE goal_lessons SET personal = ${sql.json(personal)}, personal_prompt_version = ${promptVersion}
        WHERE user_id = ${userId} AND goal_id = ${goalId} AND lesson_key = ${lessonKey}
          AND personal IS NULL
        RETURNING 1`;
      return rows.length > 0;
    },

    async recordQuiz(userId, goalId, lessonKey, record) {
      const [row] = await sql<LessonDbRow[]>`
        UPDATE goal_lessons SET
          attempts = attempts + 1,
          best_correct = GREATEST(COALESCE(best_correct, 0), ${record.correct}),
          done_at = CASE WHEN ${record.passed} THEN COALESCE(done_at, ${record.at}) ELSE done_at END
        WHERE user_id = ${userId} AND goal_id = ${goalId} AND lesson_key = ${lessonKey}
        RETURNING goal_id, lesson_key, content_id, personal, best_correct, attempts, done_at, opened_at`;
      return row ? toLesson(row) : null;
    },

    async addReport(userId, contentId, reason) {
      await sql`
        INSERT INTO lesson_reports (content_id, user_id, reason)
        VALUES (${contentId}, ${userId}, ${reason})
        ON CONFLICT (content_id, user_id) DO UPDATE SET reason = EXCLUDED.reason`;
      const [row] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM lesson_reports WHERE content_id = ${contentId}`;
      return row?.count ?? 0;
    },
  };
}
