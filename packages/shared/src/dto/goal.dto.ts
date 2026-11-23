import { z } from 'zod';
import {
  GOAL_LESSON_COUNT,
  GoalKeySchema,
  GoalLanguageSchema,
  GoalLevelSchema,
  LessonKeySchema,
} from '../goals';
import { LessonStatusSchema } from './course.dto';

/**
 * Goal lessons (ADR 0025): a person picks a goal from the catalog, the API builds its six lessons.
 * Lesson content is shared between people (no user data in it); the typed practice sentences are
 * never stored. Design: apps/docs/docs/04-modules/03-api/goals.md
 */

const DateOnlySchema = z.iso.date();

export const CreateGoalRequestSchema = z
  .object({
    goalKey: GoalKeySchema,
    language: GoalLanguageSchema.optional(),
    /** Left out: the listening level of the person, else B1. */
    level: GoalLevelSchema.optional(),
    deadline: DateOnlySchema.optional(),
  })
  .strict();
export type CreateGoalRequest = z.infer<typeof CreateGoalRequestSchema>;

export const UpdateGoalRequestSchema = z
  .object({ level: GoalLevelSchema, deadline: DateOnlySchema.nullable() })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });
export type UpdateGoalRequest = z.infer<typeof UpdateGoalRequestSchema>;

/** One lesson of a goal as the list shows it. `todo` = not opened, `learning` = opened, `done` = passed. */
export const GoalLessonSummarySchema = z
  .object({
    lessonKey: LessonKeySchema,
    titleVi: z.string(),
    status: LessonStatusSchema,
    /** Best number of right answers in the quiz; null before the first try. */
    bestCorrect: z.number().int().min(0).nullable(),
  })
  .strict();
export type GoalLessonSummary = z.infer<typeof GoalLessonSummarySchema>;

export const GoalSchema = z
  .object({
    id: z.uuid(),
    goalKey: GoalKeySchema,
    titleVi: z.string(),
    language: GoalLanguageSchema,
    level: GoalLevelSchema,
    deadline: DateOnlySchema.nullable(),
    createdAt: z.iso.datetime(),
    lessonCount: z.number().int(),
    doneCount: z.number().int(),
    /** `round(100 * done / lessonCount)`. */
    progressPct: z.number().int().min(0).max(100),
    /** The six lessons in catalog order; the titles are there before any content is made. */
    lessons: z.array(GoalLessonSummarySchema).length(GOAL_LESSON_COUNT),
  })
  .strict();
export type Goal = z.infer<typeof GoalSchema>;

/** The first lesson not done of the goal with the nearest deadline. */
export const GoalNextUpSchema = z
  .object({
    goalId: z.uuid(),
    goalTitleVi: z.string(),
    lessonKey: LessonKeySchema,
    lessonTitleVi: z.string(),
  })
  .strict();
export type GoalNextUp = z.infer<typeof GoalNextUpSchema>;

export const GoalListSchema = z
  .object({ goals: z.array(GoalSchema), nextUp: GoalNextUpSchema.nullable() })
  .strict();
export type GoalList = z.infer<typeof GoalListSchema>;

// ---- Lesson content: the four parts (AC3) ----------------------------------------------------------

export const LessonRegisterSchema = z.enum(['formal', 'neutral', 'casual']);
export type LessonRegister = z.infer<typeof LessonRegisterSchema>;

export const LESSON_QUIZ_SIZE = 6;
export const LESSON_PRACTICE_COUNT = 3;

const LineSchema = z.string().trim().min(1);

/** What the AI writes for one (goal, lesson, level, language). Strict: an extra or missing part is a failure. */
export const LessonContentSchema = z
  .object({
    situation: z
      .object({
        descriptionVi: LineSchema.max(600),
        keyPhrases: z
          .array(
            z
              .object({
                en: LineSchema.max(120),
                meaningVi: LineSchema.max(200),
                register: LessonRegisterSchema,
              })
              .strict(),
          )
          .min(5)
          .max(8),
      })
      .strict(),
    dialogue: z
      .object({
        roles: z.object({ a: LineSchema.max(40), b: LineSchema.max(40) }).strict(),
        turns: z
          .array(
            z
              .object({
                speaker: z.enum(['a', 'b']),
                en: LineSchema.max(300),
                vi: LineSchema.max(400),
              })
              .strict(),
          )
          .min(6)
          .max(10),
      })
      .strict(),
    practice: z
      .object({
        prompts: z
          .array(
            z
              .object({
                taskVi: LineSchema.max(300),
                targetPhrase: LineSchema.max(120),
                hintEn: LineSchema.max(200).optional(),
              })
              .strict(),
          )
          .length(LESSON_PRACTICE_COUNT),
      })
      .strict(),
    quiz: z
      .object({
        questions: z
          .array(
            z
              .object({
                kind: z.enum(['choice', 'cloze']),
                /** `choice`: a Vietnamese meaning or a situation. `cloze`: an English sentence with `____`. */
                prompt: LineSchema.max(400),
                options: z.array(LineSchema.max(200)).min(3).max(4),
                /** Equal to one of `options`. */
                answer: LineSchema.max(200),
                explanationVi: LineSchema.max(400),
                /** The key phrase of the question; it goes into the Phrase Bank after the quiz. */
                phrase: LineSchema.max(120),
              })
              .strict(),
          )
          .length(LESSON_QUIZ_SIZE),
      })
      .strict(),
  })
  .strict();
export type LessonContent = z.infer<typeof LessonContentSchema>;

/** Examples written from the person's own terms (`lesson.personalize`); stored per person. */
export const PersonalExampleSchema = z
  .object({ en: LineSchema.max(300), vi: LineSchema.max(400), term: LineSchema.max(120) })
  .strict();
export type PersonalExample = z.infer<typeof PersonalExampleSchema>;

export const LessonPersonalSchema = z
  .object({ examples: z.array(PersonalExampleSchema).max(3) })
  .strict();
export type LessonPersonal = z.infer<typeof LessonPersonalSchema>;

/** A quiz question as the person sees it: no answer and no explanation until they submit. */
export const LessonViewQuestionSchema = z
  .object({
    kind: z.enum(['choice', 'cloze']),
    prompt: z.string(),
    options: z.array(z.string()).min(3).max(4),
  })
  .strict();
export type LessonViewQuestion = z.infer<typeof LessonViewQuestionSchema>;

export const LessonViewSchema = z
  .object({
    goalId: z.uuid(),
    lessonKey: LessonKeySchema,
    titleVi: z.string(),
    level: GoalLevelSchema,
    /** Prompt version that wrote the content the person is pinned to (AC5). */
    promptVersion: z.string(),
    situation: LessonContentSchema.shape.situation,
    dialogue: LessonContentSchema.shape.dialogue,
    practice: LessonContentSchema.shape.practice,
    quiz: z
      .object({ questions: z.array(LessonViewQuestionSchema).length(LESSON_QUIZ_SIZE) })
      .strict(),
    /** Up to three sentences with the person's own terms; empty when there are none or they could not be made. */
    examples: z.array(PersonalExampleSchema).max(3),
    status: LessonStatusSchema,
    bestCorrect: z.number().int().min(0).nullable(),
    attempts: z.number().int().min(0),
  })
  .strict();
export type LessonView = z.infer<typeof LessonViewSchema>;

// ---- Practice, quiz, report -----------------------------------------------------------------------

export const PRACTICE_MAX_CHARS = 300;

/** The sentence is sent to the AI for feedback and then dropped: it is never stored or logged. */
export const PracticeRequestSchema = z
  .object({
    promptIndex: z
      .number()
      .int()
      .min(0)
      .max(LESSON_PRACTICE_COUNT - 1),
    sentence: z.string().trim().min(1).max(PRACTICE_MAX_CHARS),
  })
  .strict();
export type PracticeRequest = z.infer<typeof PracticeRequestSchema>;

export const PracticeVerdictSchema = z.enum(['ok', 'minor', 'wrong']);
export type PracticeVerdict = z.infer<typeof PracticeVerdictSchema>;

export const PracticeFeedbackSchema = z
  .object({
    verdict: PracticeVerdictSchema,
    grammarVi: z.string().trim().min(1).max(500).optional(),
    /** A more natural way to say it; may equal the sentence when it is already good. */
    better: z
      .string()
      .trim()
      .min(1)
      .max(PRACTICE_MAX_CHARS * 2),
    register: LessonRegisterSchema,
    registerNoteVi: z.string().trim().min(1).max(300).optional(),
  })
  .strict();
export type PracticeFeedback = z.infer<typeof PracticeFeedbackSchema>;

export const QuizSubmitRequestSchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            question: z
              .number()
              .int()
              .min(0)
              .max(LESSON_QUIZ_SIZE - 1),
            /** Index into the `options` the server sent, whatever order the client showed them in. */
            choice: z.number().int().min(0).max(3),
          })
          .strict(),
      )
      .length(LESSON_QUIZ_SIZE),
  })
  .strict()
  .refine((value) => new Set(value.answers.map((a) => a.question)).size === LESSON_QUIZ_SIZE, {
    message: 'One answer for each question',
    path: ['answers'],
  });
export type QuizSubmitRequest = z.infer<typeof QuizSubmitRequestSchema>;

export const QuizResultSchema = z
  .object({
    correct: z.number().int().min(0),
    total: z.number().int(),
    passed: z.boolean(),
    /** Needed to pass (4 of 6). */
    passMark: z.number().int(),
    bestCorrect: z.number().int().min(0),
    results: z
      .array(
        z
          .object({
            question: z.number().int(),
            correct: z.boolean(),
            /** Index of the right option. */
            answerIndex: z.number().int(),
            explanationVi: z.string(),
          })
          .strict(),
      )
      .length(LESSON_QUIZ_SIZE),
    /** Phrases added to the Phrase Bank by this submit (new ones only). */
    phrasesAdded: z.number().int().min(0),
  })
  .strict();
export type QuizResult = z.infer<typeof QuizResultSchema>;

export const LessonReportReasonSchema = z.enum([
  'english',
  'vietnamese',
  'off_goal',
  'level',
  'other',
]);
export type LessonReportReason = z.infer<typeof LessonReportReasonSchema>;

export const LessonReportRequestSchema = z.object({ reason: LessonReportReasonSchema }).strict();
export type LessonReportRequest = z.infer<typeof LessonReportRequestSchema>;
