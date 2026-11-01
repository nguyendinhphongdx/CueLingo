import { z } from 'zod';

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
]);
export type LearningEvent = z.infer<typeof LearningEventSchema>;

export const PostEventsRequestSchema = z
  .object({ events: z.array(LearningEventSchema).min(1).max(100) })
  .strict();
export type PostEventsRequest = z.infer<typeof PostEventsRequestSchema>;
