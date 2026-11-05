import { z } from 'zod';
import { LearnableLanguageSchema } from '../languages';

/** Append-only learning events sent by clients. The server stamps the user id, never the client. */
const base = { sessionId: z.uuid().optional(), at: z.iso.datetime() };

export const LearningEventSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('lookup'), term: z.string().min(1).max(80) }).strict(),
  z.object({ ...base, type: z.literal('translation_expanded'), segmentId: z.uuid() }).strict(),
  z.object({ ...base, type: z.literal('recap_used') }).strict(),
  z
    .object({
      ...base,
      type: z.literal('compose_used'),
      chosenIndex: z.number().int().min(0).max(2),
    })
    .strict(),
  z
    .object({ ...base, type: z.literal('phrase_saved'), phrase: z.string().min(1).max(200) })
    .strict(),
  /** The person's answer to a suggestion to change the assist level; it starts the quiet week. */
  z
    .object({
      ...base,
      type: z.literal('assist_suggestion'),
      action: z.enum(['applied', 'dismissed']),
      /** Language whose assist level was suggested; English when left out. */
      language: LearnableLanguageSchema.optional(),
      level: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(4)]),
    })
    .strict(),
  /** First time the desktop app was opened on this Mac (`at`), sent once after sign-in. Starts the activation clock. */
  z.object({ ...base, type: z.literal('app_installed_first_run') }).strict(),
  /** The first live caption this person saw in a real meeting. Carries no caption text. */
  z.object({ ...base, type: z.literal('first_caption_shown') }).strict(),
]);
export type LearningEvent = z.infer<typeof LearningEventSchema>;

export const PostEventsRequestSchema = z
  .object({ events: z.array(LearningEventSchema).min(1).max(100) })
  .strict();
export type PostEventsRequest = z.infer<typeof PostEventsRequestSchema>;
