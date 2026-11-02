import { z } from 'zod';
import { ErrorCode } from '../errors/error-code';

export const WordSchema = z
  .object({
    text: z.string(),
    startMs: z.number(),
    endMs: z.number(),
  })
  .strict();
export type Word = z.infer<typeof WordSchema>;

export const HelloMessageSchema = z
  .object({
    type: z.literal('hello'),
    sessionId: z.uuid(),
    token: z.string().min(1),
    sttSource: z.literal('local'),
    assistLevel: z.number().int().min(0).max(5),
  })
  .strict();
export type HelloMessage = z.infer<typeof HelloMessageSchema>;

export const SegmentFinalMessageSchema = z
  .object({
    type: z.literal('segment.final'),
    segmentId: z.uuid(),
    stream: z.enum(['system', 'mic']),
    startMs: z.number(),
    endMs: z.number(),
    text: z.string().min(1).max(2_000),
    words: z.array(WordSchema),
  })
  .strict()
  .refine(({ startMs, endMs }) => endMs >= startMs, {
    message: 'endMs must be greater than or equal to startMs',
    path: ['endMs'],
  });
export type SegmentFinalMessage = z.infer<typeof SegmentFinalMessageSchema>;

/**
 * The meeting's language was changed over REST. It carries no language itself: the server re-reads the
 * session, so a socket cannot pick a language for a meeting it does not own.
 */
export const LanguageSetMessageSchema = z.object({ type: z.literal('language.set') }).strict();
export type LanguageSetMessage = z.infer<typeof LanguageSetMessageSchema>;

export const EventMessageSchema = z.object({ type: z.literal('event') }).strict();
export type EventMessage = z.infer<typeof EventMessageSchema>;

export const ClientMessageSchema = z.discriminatedUnion('type', [
  HelloMessageSchema,
  SegmentFinalMessageSchema,
  LanguageSetMessageSchema,
  EventMessageSchema,
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const ReadyMessageSchema = z
  .object({
    type: z.literal('ready'),
    sessionId: z.uuid(),
  })
  .strict();
export type ReadyMessage = z.infer<typeof ReadyMessageSchema>;

export const TranslationMessageSchema = z
  .object({
    type: z.literal('translation'),
    segmentId: z.uuid(),
    textVi: z.string(),
    hardWords: z.array(z.string()),
  })
  .strict();
export type TranslationMessage = z.infer<typeof TranslationMessageSchema>;

export const ErrorMessageSchema = z
  .object({
    type: z.literal('error'),
    code: z.enum(ErrorCode),
    retryable: z.boolean(),
  })
  .strict();
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  ReadyMessageSchema,
  TranslationMessageSchema,
  ErrorMessageSchema,
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
