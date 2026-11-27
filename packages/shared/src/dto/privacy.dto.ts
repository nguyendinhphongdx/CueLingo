import { z } from 'zod';
import { ConversationDetailSchema } from './agent.dto';
import { DebriefSchema } from './debrief.dto';
import { GlossaryTermSchema } from './glossary.dto';
import { MeetingQuestionSchema } from './meeting-assist.dto';
import { PhraseSchema } from './phrase.dto';
import { SessionDetailSchema } from './session.dto';

export const DeleteMyDataRequestSchema = z.object({ confirm: z.literal('XOA DU LIEU') }).strict();
export type DeleteMyDataRequest = z.infer<typeof DeleteMyDataRequestSchema>;

/** `GET /v1/me/export`. Unknown query keys are ignored, as before. */
export const ExportQuerySchema = z.object({
  include: z.literal('meeting_questions').optional(),
});
export type ExportQuery = z.infer<typeof ExportQuerySchema>;

export const ExportSessionSchema = SessionDetailSchema.extend({
  debrief: DebriefSchema.nullable(),
  /** Only with `?include=meeting_questions`: clients up to 0.1.12 refuse an unknown key. */
  questions: z.array(MeetingQuestionSchema).optional(),
}).strict();
export type ExportSession = z.infer<typeof ExportSessionSchema>;

export const ExportSchema = z
  .object({
    exportedAt: z.iso.datetime(),
    sessions: z.array(ExportSessionSchema),
    phrases: z.array(PhraseSchema),
    glossaryTerms: z.array(GlossaryTermSchema),
    /** Assistant conversations that are not deleted, each with its messages. An older server omits it. */
    conversations: z.array(ConversationDetailSchema).default([]),
  })
  .strict();
export type Export = z.infer<typeof ExportSchema>;
