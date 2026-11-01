import { z } from 'zod';

/** Spaced review of the Phrase Bank: the API builds each exercise, the client only renders and grades locally. */
export const ExerciseTypeSchema = z.enum(['recognize', 'cloze']);
export type ExerciseType = z.infer<typeof ExerciseTypeSchema>;

export const ReviewCardSchema = z
  .object({
    itemId: z.uuid(),
    exercise: ExerciseTypeSchema,
    phrase: z.string(),
    /** recognize: the English phrase to translate. cloze: a sentence with `____` where the phrase goes. */
    prompt: z.string(),
    /** recognize: Vietnamese meanings (one correct). cloze: English phrases (one correct). */
    choices: z.array(z.string()).min(2).max(4),
    answer: z.string(),
    /** Meaning and the sentence the phrase first appeared in, shown after answering. */
    meaningVi: z.string().nullable(),
    contextEn: z.string().nullable(),
  })
  .strict();
export type ReviewCard = z.infer<typeof ReviewCardSchema>;

export const ReviewQueueSchema = z
  .object({ dueCount: z.number().int(), cards: z.array(ReviewCardSchema).max(20) })
  .strict();
export type ReviewQueue = z.infer<typeof ReviewQueueSchema>;

export const ReviewAnswerRequestSchema = z
  .object({
    itemId: z.uuid(),
    exercise: ExerciseTypeSchema,
    /** FSRS rating: 1 again · 2 hard · 3 good · 4 easy. */
    rating: z.number().int().min(1).max(4),
    responseMs: z.number().int().min(0).max(600_000).optional(),
  })
  .strict();
export type ReviewAnswerRequest = z.infer<typeof ReviewAnswerRequestSchema>;

export const ReviewAnswerResponseSchema = z.object({ nextDue: z.iso.datetime() }).strict();
export type ReviewAnswerResponse = z.infer<typeof ReviewAnswerResponseSchema>;

export const ProgressSchema = z
  .object({
    phrasesSaved: z.number().int(),
    phrasesInReview: z.number().int(),
    dueToday: z.number().int(),
    streakDays: z.number().int(),
    meetingsCount: z.number().int(),
    /** Average of the latest debriefs; null with no debrief yet. */
    avgComprehensionPct: z.number().nullable(),
    /** Last 7 days, oldest first. */
    reviewsLast7Days: z
      .array(z.object({ date: z.string(), count: z.number().int() }).strict())
      .length(7),
    /** Lookups per meeting by week (lower is better); last 4 weeks, oldest first. */
    weekly: z
      .array(
        z
          .object({
            weekStart: z.string(),
            meetings: z.number().int(),
            lookups: z.number().int(),
          })
          .strict(),
      )
      .length(4),
  })
  .strict();
export type Progress = z.infer<typeof ProgressSchema>;
