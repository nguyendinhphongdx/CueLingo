import { z } from 'zod';

const LevelSchema = z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(4)]);

/** Whether to offer a different assist level, from how the last meetings went. Never applied automatically. */
export const AssistSuggestionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('keep'), currentLevel: LevelSchema }).strict(),
  z
    .object({
      kind: z.enum(['lower', 'raise']),
      currentLevel: LevelSchema,
      suggestedLevel: LevelSchema,
      meetingsConsidered: z.number().int(),
      avgComprehensionPct: z.number(),
    })
    .strict(),
]);
export type AssistSuggestion = z.infer<typeof AssistSuggestionSchema>;
