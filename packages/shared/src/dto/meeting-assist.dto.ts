import { z } from 'zod';
import { ErrorCode } from '../errors/error-code';

/** The assistant a person asks during a meeting (ADR 0027). */

/** Which wording of the consent the person agreed to; a new wording asks again. */
export const MEETING_ASSIST_CONSENT_VERSION = 'meeting-assist@v1';

export const MEETING_QUESTION_MAX = 500;
export const MEETING_ANSWER_MAX = 6_000;

export const AskMeetingRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(MEETING_QUESTION_MAX),
    /** The caption the person pointed at. `text` covers a sentence the server has not stored yet. */
    focus: z
      .object({ segmentId: z.uuid().optional(), text: z.string().trim().min(1).max(2_000) })
      .strict()
      .optional(),
    /** Ask for a longer explanation than the short default. */
    detail: z.boolean().optional(),
  })
  .strict();
export type AskMeetingRequest = z.infer<typeof AskMeetingRequestSchema>;

/** Where an answer came from. Only sources the server really read and the answer cites are listed. */
export const MeetingAnswerSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('current_meeting') }).strict(),
  z
    .object({
      kind: z.literal('past_meeting'),
      sessionId: z.uuid(),
      title: z.string().nullable(),
      startedAt: z.iso.datetime(),
    })
    .strict(),
  z.object({ kind: z.literal('glossary') }).strict(),
  z.object({ kind: z.literal('phrases') }).strict(),
  /** The model's own knowledge: not checked against anything the person owns. */
  z.object({ kind: z.literal('general') }).strict(),
]);
export type MeetingAnswerSource = z.infer<typeof MeetingAnswerSourceSchema>;

export const MeetingAnswerStatusSchema = z.enum(['complete', 'stopped', 'error']);
export type MeetingAnswerStatus = z.infer<typeof MeetingAnswerStatusSchema>;

/** One server-sent event of an answer. `done` is always last; a failure sends `error`, then `done{error}`. */
export const MeetingAskStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), status: z.enum(['searching', 'answering']) }).strict(),
  z.object({ type: z.literal('text_delta'), text: z.string() }).strict(),
  z.object({ type: z.literal('sources'), items: z.array(MeetingAnswerSourceSchema) }).strict(),
  z
    .object({ type: z.literal('done'), status: MeetingAnswerStatusSchema, questionId: z.uuid() })
    .strict(),
  z.object({ type: z.literal('error'), code: z.enum(ErrorCode) }).strict(),
]);
export type MeetingAskStreamEvent = z.infer<typeof MeetingAskStreamEventSchema>;

/** A stored question and its answer, as exported with its meeting. */
export const MeetingQuestionSchema = z
  .object({
    id: z.uuid(),
    question: z.string(),
    answer: z.string(),
    sources: z.array(MeetingAnswerSourceSchema),
    status: MeetingAnswerStatusSchema,
    createdAt: z.iso.datetime(),
  })
  .strict();
export type MeetingQuestion = z.infer<typeof MeetingQuestionSchema>;

/** `GET /v1/me/meeting-assist`. */
export const MeetingAssistStatusSchema = z
  .object({ enabled: z.boolean(), consent: z.boolean() })
  .strict();
export type MeetingAssistStatus = z.infer<typeof MeetingAssistStatusSchema>;

export const SetMeetingAssistConsentRequestSchema = z.object({ granted: z.boolean() }).strict();
export type SetMeetingAssistConsentRequest = z.infer<typeof SetMeetingAssistConsentRequestSchema>;

/**
 * Removes the source markers the model writes (`[1]`, `[G]`, `[1, 2]`) from text a person reads.
 * Also drops a marker cut in half at the end of a stream, so it never flashes on screen.
 */
export function stripSourceTags(text: string): string {
  return text
    .replace(/[ \t]*\[(?:G|\d{1,2})(?:\s*,\s*(?:G|\d{1,2}))*\]/g, '')
    .replace(/[ \t]*\[(?:G|\d{0,2})(?:\s*,\s*(?:G|\d{0,2}))*$/, '');
}
