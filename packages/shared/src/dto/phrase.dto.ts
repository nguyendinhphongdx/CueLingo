import { z } from 'zod';

/** Phrase Bank: phrases the user saved (from a debrief or a lookup) so they can be reviewed later. */
export const SavePhraseRequestSchema = z
  .object({
    phrase: z.string().trim().min(1).max(200),
    meaningVi: z.string().trim().max(500).optional(),
    sessionId: z.uuid().optional(),
    segmentId: z.uuid().optional(),
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
