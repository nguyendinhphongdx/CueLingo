import { z } from 'zod';
import { LanguageCodeSchema } from '../languages';

export const FollowupChannelSchema = z.enum(['email', 'chat']);
export type FollowupChannel = z.infer<typeof FollowupChannelSchema>;

export const FollowupToneSchema = z.enum(['brief', 'polite', 'friendly']);
export type FollowupTone = z.infer<typeof FollowupToneSchema>;

/** Asks for a follow-up message drafted from one finished meeting. */
export const FollowupRequestSchema = z
  .object({ channel: FollowupChannelSchema, tone: FollowupToneSchema })
  .strict();
export type FollowupRequest = z.infer<typeof FollowupRequestSchema>;

export const FollowupResponseSchema = z
  .object({
    /** Null for the chat channel. */
    subject: z
      .string()
      .max(200)
      .regex(/^[^\r\n]*$/, 'No line break in a subject')
      .nullable(),
    body: z.string().min(1).max(4000),
    language: LanguageCodeSchema,
  })
  .strict();
export type FollowupResponse = z.infer<typeof FollowupResponseSchema>;
