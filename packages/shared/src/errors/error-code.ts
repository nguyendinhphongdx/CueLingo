import { z } from 'zod';

/** Error codes shared by api (throws) and core-sdk (parses). Add new codes here only. */
export const ErrorCode = {
  Validation: 'VALIDATION_ERROR',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  AssistFailed: 'ASSIST_FAILED',
  TtsFailed: 'TTS_FAILED',
  TranscribeFailed: 'TRANSCRIBE_FAILED',
  AudioTooLarge: 'AUDIO_TOO_LARGE',
  LanguageNotCloud: 'LANGUAGE_NOT_CLOUD',
  RateLimited: 'RATE_LIMITED',
  Internal: 'INTERNAL_ERROR',
  WsUnauthorized: 'ws_unauthorized',
  WsBadMessage: 'ws_bad_message',
  WsTranslationFailed: 'ws_translation_failed',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum(ErrorCode),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
