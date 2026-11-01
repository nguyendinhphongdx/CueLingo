import { z } from 'zod';
import { DebriefSchema } from './debrief.dto';
import { GlossaryTermSchema } from './glossary.dto';
import { PhraseSchema } from './phrase.dto';
import { SessionDetailSchema } from './session.dto';

export const DeleteMyDataRequestSchema = z.object({ confirm: z.literal('XOA DU LIEU') }).strict();
export type DeleteMyDataRequest = z.infer<typeof DeleteMyDataRequestSchema>;

export const ExportSessionSchema = SessionDetailSchema.extend({
  debrief: DebriefSchema.nullable(),
}).strict();
export type ExportSession = z.infer<typeof ExportSessionSchema>;

export const ExportSchema = z
  .object({
    exportedAt: z.iso.datetime(),
    sessions: z.array(ExportSessionSchema),
    phrases: z.array(PhraseSchema),
    glossaryTerms: z.array(GlossaryTermSchema),
  })
  .strict();
export type Export = z.infer<typeof ExportSchema>;
