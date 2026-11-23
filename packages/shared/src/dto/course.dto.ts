import { z } from 'zod';
import { LanguageCodeSchema, LearnableLanguageSchema } from '../languages';

/**
 * Learning path: a course is a view over one meeting's debrief and the user's review history.
 * Nothing here is stored; exercises and answers reuse the review contract (`review.dto.ts`).
 */
export const LessonStatusSchema = z.enum(['todo', 'learning', 'done']);
export type LessonStatus = z.infer<typeof LessonStatusSchema>;

/** Where a lesson came from in the debrief: a phrase said in a hard segment, a suggested phrase, a better way to say it. */
export const LessonOriginSchema = z.enum(['hard', 'phrase', 'rephrase']);
export type LessonOrigin = z.infer<typeof LessonOriginSchema>;

export const LessonSchema = z
  .object({
    phrase: z.string(),
    /** Null until the phrase is in the Phrase Bank ("Bắt đầu khoá" saves it). */
    itemId: z.uuid().nullable(),
    meaningVi: z.string().nullable(),
    status: LessonStatusSchema,
    origin: LessonOriginSchema,
  })
  .strict();
export type Lesson = z.infer<typeof LessonSchema>;

export const CourseSummarySchema = z
  .object({
    /** A course is identified by the meeting it was made from. */
    sessionId: z.uuid(),
    headline: z.string(),
    startedAt: z.iso.datetime(),
    language: LanguageCodeSchema,
    lessonCount: z.number().int(),
    doneCount: z.number().int(),
    /** `round(100 * done / total)`. */
    progressPct: z.number().int().min(0).max(100),
    /** Lessons whose phrase is not in the Phrase Bank yet. */
    unsavedCount: z.number().int(),
  })
  .strict();
export type CourseSummary = z.infer<typeof CourseSummarySchema>;

export const CourseSchema = CourseSummarySchema.extend({ lessons: z.array(LessonSchema) }).strict();
export type Course = z.infer<typeof CourseSchema>;

/** "What to do next": the first lesson not done of the course in progress. */
export const CourseNextUpSchema = z
  .object({
    sessionId: z.uuid(),
    headline: z.string(),
    phrase: z.string(),
    saved: z.boolean(),
  })
  .strict();
export type CourseNextUp = z.infer<typeof CourseNextUpSchema>;

export const CourseListSchema = z
  .object({ courses: z.array(CourseSummarySchema), nextUp: CourseNextUpSchema.nullable() })
  .strict();
export type CourseList = z.infer<typeof CourseListSchema>;

/** `POST /v1/courses/:sessionId/start`: how many phrases were added to the Phrase Bank. */
export const StartCourseResponseSchema = z.object({ added: z.number().int() }).strict();
export type StartCourseResponse = z.infer<typeof StartCourseResponseSchema>;

/**
 * Meeting preparation. The desktop app matches calendar titles with meeting titles on the device
 * and sends only ids; a calendar title never reaches the server.
 */
export const PrepCourseRequestSchema = z
  .object({
    sessionIds: z.array(z.uuid()).min(1).max(5),
    language: LearnableLanguageSchema.optional(),
  })
  .strict();
export type PrepCourseRequest = z.infer<typeof PrepCourseRequestSchema>;

export const PrepCourseSchema = z
  .object({
    /** Saved phrases from those meetings, the ones to refresh first on top. */
    lessons: z.array(LessonSchema).max(10),
    /** The user's glossary terms in the same language, shown only. */
    terms: z
      .array(z.object({ term: z.string(), translation: z.string().nullable() }).strict())
      .max(10),
  })
  .strict();
export type PrepCourse = z.infer<typeof PrepCourseSchema>;
