import { z } from 'zod';
import { LearnableLanguageSchema } from '../languages';

/** One spelling per phrase: collapse whitespace and lowercase, so "Follow  UP" and "follow up" are one row. */
export const normalizePhrase = (phrase: string): string =>
  phrase.replace(/\s+/g, ' ').toLowerCase();

/** Phrase Bank: phrases the user saved (from a debrief or a lookup) so they can be reviewed later. */
export const SavePhraseRequestSchema = z
  .object({
    phrase: z.string().trim().min(1).max(200),
    meaningVi: z.string().trim().max(500).optional(),
    sessionId: z.uuid().optional(),
    segmentId: z.uuid().optional(),
    /** Used when the phrase is not tied to a meeting; a meeting's own language wins. */
    language: LearnableLanguageSchema.optional(),
    /** The sentence the phrase was read in (assistant chat); kept as the review context when no meeting segment exists. */
    context: z.string().trim().max(500).optional(),
  })
  .strict();
export type SavePhraseRequest = z.infer<typeof SavePhraseRequestSchema>;

export const PhraseSchema = z
  .object({
    id: z.uuid(),
    phrase: z.string(),
    meaningVi: z.string().nullable(),
    inReview: z.boolean(),
  })
  .strict();
export type Phrase = z.infer<typeof PhraseSchema>;

export const PhraseListSchema = z.object({ phrases: z.array(PhraseSchema) }).strict();
export type PhraseList = z.infer<typeof PhraseListSchema>;
