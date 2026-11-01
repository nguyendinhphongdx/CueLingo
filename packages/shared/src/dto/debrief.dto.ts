import { z } from 'zod';

/** What the debrief worker produces and the web app shows: five blocks plus a comprehension score. */
export const DebriefContentSchema = z
  .object({
    /** Block 1: what the meeting was about. */
    summary: z.object({ headlineVi: z.string(), bulletsVi: z.array(z.string()).max(6) }).strict(),
    /** Block 2: decisions and to-dos. */
    actionItems: z
      .array(
        z
          .object({
            textVi: z.string(),
            owner: z.string().optional(),
            kind: z.enum(['decision', 'todo']),
          })
          .strict(),
      )
      .max(12),
    /** Block 3: segments the user probably found hard (ids refer to stored segments). */
    hardSegmentIds: z.array(z.uuid()).max(10),
    /** Block 4: phrases worth saving. */
    phraseSuggestions: z
      .array(
        z
          .object({
            phrase: z.string(),
            meaningVi: z.string(),
            exampleEn: z.string().optional(),
          })
          .strict(),
      )
      .max(10),
    /** Block 5: what the user said → what a fluent speaker would say. */
    rephrase: z
      .array(
        z.object({ said: z.string(), better: z.string(), noteVi: z.string().optional() }).strict(),
      )
      .max(6),
    /** Rough share of the meeting the user understood; null when the data is too thin. */
    comprehensionPct: z.number().min(0).max(100).nullable(),
  })
  .strict();
export type DebriefContent = z.infer<typeof DebriefContentSchema>;

export const DebriefSchema = DebriefContentSchema.extend({
  id: z.uuid(),
  sessionId: z.uuid(),
  version: z.number().int(),
  createdAt: z.iso.datetime(),
}).strict();
export type Debrief = z.infer<typeof DebriefSchema>;

export const DebriefFeedbackRequestSchema = z
  .object({
    block: z.enum(['summary', 'actionItems', 'hardSegments', 'phraseSuggestions', 'rephrase']),
    useful: z.boolean(),
  })
  .strict();
export type DebriefFeedbackRequest = z.infer<typeof DebriefFeedbackRequestSchema>;
