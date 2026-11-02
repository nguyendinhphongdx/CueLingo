import { z } from 'zod';
import { LanguageCodeSchema } from '../languages';

/** Listening placement test: six passages heard once or twice, one question each (docs: P2-08). */
export const PLACEMENT_PASSAGE_COUNT = 6;

/** A passage to play (through `POST /v1/tts`) and the question that checks it was understood. */
export const PlacementPassageSchema = z
  .object({
    id: z.string().min(1),
    /** The text to read aloud; show it only after the answer. */
    text: z.string().min(1),
    /** Question in Vietnamese: the test measures listening, not reading English. */
    question: z.string().min(1),
    choices: z.array(z.string().min(1)).length(3),
  })
  .strict();
export type PlacementPassage = z.infer<typeof PlacementPassageSchema>;

export const PlacementTestSchema = z
  .object({
    language: LanguageCodeSchema,
    passages: z.array(PlacementPassageSchema).length(PLACEMENT_PASSAGE_COUNT),
  })
  .strict();
export type PlacementTest = z.infer<typeof PlacementTestSchema>;

export const PlacementLevelSchema = z.enum(['a2', 'b1', 'b2', 'c1']);
export type PlacementLevel = z.infer<typeof PlacementLevelSchema>;

export const SubmitPlacementRequestSchema = z
  .object({
    language: LanguageCodeSchema.optional(),
    answers: z
      .array(
        z.object({ passageId: z.string().min(1), choice: z.number().int().min(0).max(2) }).strict(),
      )
      .max(PLACEMENT_PASSAGE_COUNT),
  })
  .strict();
export type SubmitPlacementRequest = z.infer<typeof SubmitPlacementRequestSchema>;

export const PlacementResultSchema = z
  .object({
    language: LanguageCodeSchema,
    correct: z.number().int(),
    total: z.number().int(),
    listeningLevel: PlacementLevelSchema,
    /** The assist level this result sets as the default for the language. */
    assistDefault: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(4)]),
    /** Passage id → the choice that was right, shown after submitting. */
    answers: z.array(z.object({ passageId: z.string(), correctChoice: z.number().int() }).strict()),
  })
  .strict();
export type PlacementResult = z.infer<typeof PlacementResultSchema>;
