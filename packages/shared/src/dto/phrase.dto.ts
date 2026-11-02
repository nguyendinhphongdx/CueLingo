import { z } from 'zod';
import { EnabledLanguageSchema } from '../languages';

/** Phrase Bank: phrases the user saved (from a debrief or a lookup) so they can be reviewed later. */
export const SavePhraseRequestSchema = z
  .object({
    phrase: z.string().trim().min(1).max(200),
    meaningVi: z.string().trim().max(500).optional(),
    sessionId: z.uuid().optional(),
    segmentId: z.uuid().optional(),
    /** Used when the phrase is not tied to a meeting; a meeting's own language wins. */
    language: EnabledLanguageSchema.optional(),
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
