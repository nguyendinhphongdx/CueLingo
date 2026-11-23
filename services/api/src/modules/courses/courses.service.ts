import {
  buildLessons,
  courseProgress,
  lessonStatus,
  orderPrepLessons,
  pickNextUp,
  SITTING_SIZE,
  type DraftLesson,
} from '@cuelingo/learner-model';
import {
  ErrorCode,
  normalizePhrase,
  SUPPORTED_LANGUAGES,
  type Course,
  type CourseList,
  type CourseNextUp,
  type LanguageCode,
  type Lesson,
  type Phrase,
  type PrepCourse,
  type ReviewCard,
  type ReviewQueue,
  type SavePhraseRequest,
  type StartCourseResponse,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import { buildCard, type StudyItem } from '../review';
import type { CourseLog, CoursesRepository, CourseSourceRow } from './courses.repository';

export type CoursesService = ReturnType<typeof createCoursesService>;

/** Meetings looked at when listing courses. */
export const COURSE_LIST_LIMIT = 20;
const PREP_LESSONS = 10;
const PREP_TERMS = 10;

/** What the service takes from other modules; wired in `app.ts`. */
export interface CoursesPorts {
  listItems(userId: string, language: LanguageCode): Promise<StudyItem[]>;
  savePhrase(userId: string, input: SavePhraseRequest): Promise<Phrase>;
}

interface BuiltCourse {
  course: Course;
  drafts: DraftLesson[];
  row: CourseSourceRow;
}

/**
 * Courses are computed on every read from the debrief, the Phrase Bank and the review logs.
 * Progress is a function of `review_logs` only, so there is no second scorer and nothing to delete
 * with a meeting. Design: apps/docs/docs/04-modules/03-api/courses.md
 */
export function createCoursesService(
  repo: CoursesRepository,
  ports: CoursesPorts,
  clock: () => Date = () => new Date(),
) {
  function assemble(rows: CourseSourceRow[], items: StudyItem[], logs: CourseLog[]): BuiltCourse[] {
    const lexicon = items.map((item) => ({
      itemId: item.itemId,
      phrase: normalizePhrase(item.phrase),
      meaningVi: item.meaningVi,
      contextEn: item.contextEn,
    }));
    const built: BuiltCourse[] = [];
    for (const row of rows) {
      if (!SUPPORTED_LANGUAGES[row.language].learnable) continue;
      const drafts = buildLessons(row.source, lexicon);
      if (drafts.length === 0) continue;
      const lessons: Lesson[] = drafts.map((draft) => ({
        phrase: draft.phrase,
        itemId: draft.itemId,
        meaningVi: draft.meaningVi,
        origin: draft.origin,
        status: draft.itemId
          ? lessonStatus(
              logs.filter((log) => log.itemId === draft.itemId),
              row.debriefAt,
            )
          : 'todo',
      }));
      const progress = courseProgress(lessons);
      built.push({
        drafts,
        row,
        course: {
          sessionId: row.sessionId,
          headline: row.headline,
          startedAt: row.startedAt.toISOString(),
          language: row.language,
          lessonCount: progress.total,
          doneCount: progress.done,
          progressPct: progress.pct,
          unsavedCount: lessons.filter((lesson) => lesson.itemId === null).length,
          lessons,
        },
      });
    }
    return built;
  }

  /** One query per table for any number of meetings (no N+1). */
  async function load(userId: string, rows: CourseSourceRow[], language: LanguageCode) {
    if (rows.length === 0) return [];
    const items = await ports.listItems(userId, language);
    const since = new Date(Math.min(...rows.map((row) => row.debriefAt.getTime())));
    const logs = await repo.listLogs(
      userId,
      items.map((item) => item.itemId),
      since,
    );
    return assemble(rows, items, logs);
  }

  async function find(userId: string, sessionId: string) {
    const [row] = await repo.listSources(userId, { sessionIds: [sessionId], limit: 1 });
    const [built] = row ? await load(userId, [row], row.language) : [];
    if (!built) throw new AppError(ErrorCode.NotFound, 'Course not found');
    return built;
  }

  return {
    async list(userId: string, language: LanguageCode): Promise<CourseList> {
      const rows = await repo.listSources(userId, { language, limit: COURSE_LIST_LIMIT });
      const courses = (await load(userId, rows, language)).map((entry) => entry.course);
      const next = pickNextUp(courses);
      const nextUp: CourseNextUp | null = next && {
        sessionId: next.course.sessionId,
        headline: next.course.headline,
        phrase: next.course.lessons[next.lessonIndex]!.phrase,
        saved: next.course.lessons[next.lessonIndex]!.itemId !== null,
      };
      return {
        courses: courses.map(({ lessons: _lessons, ...summary }) => summary),
        nextUp,
      };
    },

    async get(userId: string, sessionId: string): Promise<Course> {
      return (await find(userId, sessionId)).course;
    },

    /** Saves the phrases of the course that are not in the Phrase Bank yet (idempotent). */
    async start(userId: string, sessionId: string): Promise<StartCourseResponse> {
      const { drafts, row } = await find(userId, sessionId);
      let added = 0;
      for (const draft of drafts.filter((lesson) => lesson.itemId === null)) {
        await ports.savePhrase(userId, {
          phrase: draft.phrase,
          ...(draft.meaningVi ? { meaningVi: draft.meaningVi.slice(0, 500) } : {}),
          sessionId,
          ...(draft.segmentId
            ? { segmentId: draft.segmentId }
            : draft.contextEn
              ? { context: draft.contextEn.slice(0, 500) }
              : {}),
          language: row.language as SavePhraseRequest['language'],
        });
        added += 1;
      }
      return { added };
    },

    /** The next sitting: up to `SITTING_SIZE` saved lessons not done, as ordinary review cards. */
    async queue(
      userId: string,
      sessionId: string,
      options: { dictation?: boolean } = {},
    ): Promise<ReviewQueue> {
      const { course, row } = await find(userId, sessionId);
      const items = await ports.listItems(userId, row.language);
      const open = course.lessons.filter((lesson) => lesson.status !== 'done');
      const cards: ReviewCard[] = [];
      for (const lesson of open) {
        if (cards.length === SITTING_SIZE) break;
        const item = items.find((candidate) => candidate.itemId === lesson.itemId);
        const card = item && buildCard(item, items, { ...options, language: row.language });
        if (card) cards.push(card);
      }
      return { dueCount: open.length, cards };
    },

    /** Preparation for a meeting: saved phrases from the given meetings plus glossary terms. Writes nothing. */
    async prep(
      userId: string,
      input: { sessionIds: string[]; language: LanguageCode },
    ): Promise<PrepCourse> {
      const rows = await repo.listSources(userId, {
        sessionIds: input.sessionIds,
        language: input.language,
        limit: input.sessionIds.length,
      });
      const items = await ports.listItems(userId, input.language);
      const fsrsOf = new Map(items.map((item) => [item.itemId, item.fsrs]));
      const built = await load(userId, rows, input.language);
      const unique = new Map<string, Lesson>();
      for (const { course } of built) {
        for (const lesson of course.lessons) {
          if (lesson.itemId && !unique.has(lesson.itemId)) unique.set(lesson.itemId, lesson);
        }
      }
      const lessons = orderPrepLessons(
        [...unique.values()].map((lesson) => ({
          lesson,
          fsrs: fsrsOf.get(lesson.itemId!) ?? null,
        })),
        clock(),
      )
        .slice(0, PREP_LESSONS)
        .map((entry) => entry.lesson);
      return { lessons, terms: await repo.listTerms(userId, input.language, PREP_TERMS) };
    },
  };
}
