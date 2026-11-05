import { z } from 'zod';

export const FEEDBACK_MAX_LENGTH = 2000;

export const FeedbackKindSchema = z.enum(['bug', 'idea']);
export type FeedbackKind = z.infer<typeof FeedbackKindSchema>;

/**
 * What a tester sends. `.strict()` is the privacy rule: nothing but what the person typed plus the app and
 * OS version can travel with it, so a transcript, audio or token has no field to ride in.
 */
export const CreateFeedbackRequestSchema = z
  .object({
    kind: FeedbackKindSchema,
    message: z.string().trim().min(1).max(FEEDBACK_MAX_LENGTH),
    client: z.enum(['desktop', 'web']),
    appVersion: z.string().trim().max(40),
    os: z.string().trim().max(80),
  })
  .strict();
export type CreateFeedbackRequest = z.infer<typeof CreateFeedbackRequestSchema>;

export const FeedbackSchema = z.object({ id: z.uuid(), createdAt: z.iso.datetime() });
export type Feedback = z.infer<typeof FeedbackSchema>;
