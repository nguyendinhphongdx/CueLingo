import { z } from 'zod';
import { LanguageCodeSchema } from '../languages';

/** Quick Assist: contextual word lookup, recap of the last minute, and VI → EN composing. */
export const LookupRequestSchema = z
  .object({
    term: z.string().trim().min(1).max(80),
    /** Sentence(s) the term appeared in. */
    context: z.string().max(600).optional(),
    /** Language of the term; English when left out. */
    language: LanguageCodeSchema.optional(),
  })
  .strict();
export type LookupRequest = z.infer<typeof LookupRequestSchema>;

export const LookupResponseSchema = z
  .object({
    term: z.string(),
    pos: z.string().optional(),
    meaningVi: z.string(),
    exampleEn: z.string().optional(),
    /** How the term is read aloud (furigana for Japanese); only for languages that have readings. */
    reading: z.string().optional(),
    noteVi: z.string().optional(),
  })
  .strict();
export type LookupResponse = z.infer<typeof LookupResponseSchema>;

export const RecapRequestSchema = z
  .object({
    sentences: z
      .array(
        z
          .object({ speaker: z.string().max(40).optional(), text: z.string().min(1).max(2_000) })
          .strict(),
      )
      .min(1)
      .max(40),
    language: LanguageCodeSchema.optional(),
  })
  .strict();
export type RecapRequest = z.infer<typeof RecapRequestSchema>;

export const RecapResponseSchema = z
  .object({
    summaryVi: z.string(),
    bulletsVi: z.array(z.string()).max(5),
  })
  .strict();
export type RecapResponse = z.infer<typeof RecapResponseSchema>;

export const ComposeRequestSchema = z
  .object({
    intentVi: z.string().trim().min(1).max(400),
    /** Recent meeting sentences so the reply fits the conversation. */
    context: z.array(z.string().max(2_000)).max(10).optional(),
    /** Language the sentence should be spoken in; English when left out. */
    language: LanguageCodeSchema.optional(),
  })
  .strict();
export type ComposeRequest = z.infer<typeof ComposeRequestSchema>;

export const ComposeResponseSchema = z
  .object({
    options: z
      .array(z.object({ en: z.string(), noteVi: z.string().optional() }).strict())
      .min(1)
      .max(3),
  })
  .strict();
export type ComposeResponse = z.infer<typeof ComposeResponseSchema>;
