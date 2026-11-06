import { defineTool, type AgentPermission, type AgentPlugin } from '@cuelingo/agent';
import { AgentCardSchema } from '@cuelingo/shared';
import { z } from 'zod';
import type { CoreCapabilities } from '../core';
import { fromPhrases, fromText, MAX_ITEMS } from './build';

export const EXERCISE_PLUGIN_ID = 'exercise';
export const EXERCISE_PERMISSIONS: AgentPermission[] = ['phrases:read', 'cards'];

/** All the plugin reaches: the user's saved phrases. The registry hands it nothing else (permissions above). */
type ExerciseCapabilities = Pick<CoreCapabilities, 'listPhrases'>;

const createExercise = defineTool<
  ExerciseCapabilities,
  {
    kind: 'cloze' | 'quiz_choice';
    source: 'saved_phrases' | 'text';
    text?: string;
    count?: number;
  },
  { created: boolean; card?: z.infer<typeof AgentCardSchema>; problem?: string }
>({
  name: 'create_exercise',
  description:
    'Build a small practice card for the user: kind "cloze" (fill the blank) or "quiz_choice" (pick the right option). ' +
    'source "saved_phrases" uses the phrases the user saved; source "text" needs the English text in `text`. ' +
    `count is how many blanks for cloze (1-${MAX_ITEMS}). The card is shown to the user; do not repeat it in your reply.`,
  kind: 'read',
  input: z
    .object({
      kind: z.enum(['cloze', 'quiz_choice']),
      source: z.enum(['saved_phrases', 'text']),
      text: z.string().trim().min(1).max(1500).optional(),
      count: z.number().int().min(1).max(MAX_ITEMS).optional(),
    })
    .refine((input) => input.source !== 'text' || Boolean(input.text), {
      path: ['text'],
      message: 'text is required when source is "text"',
    }),
  output: z.object({
    created: z.boolean(),
    card: AgentCardSchema.optional(),
    problem: z.string().max(200).optional(),
  }),
  async run(input, ctx) {
    const count = input.count ?? 3;
    const built =
      input.source === 'text'
        ? fromText(input.kind, input.text ?? '', count)
        : fromPhrases(input.kind, await ctx.capabilities.listPhrases(), count);
    return 'card' in built
      ? { created: true, card: built.card }
      : { created: false, problem: built.problem };
  },
  toCard: (output) => output.card,
  summarize: (output) => (output.created ? 'Đã tạo bài tập' : 'Chưa tạo được bài tập'),
});

/** Second plugin: practice cards from saved phrases or given text. Added in the composition root only. */
export const exercisePlugin: AgentPlugin<ExerciseCapabilities> = {
  id: EXERCISE_PLUGIN_ID,
  version: '1.0.0',
  permissions: EXERCISE_PERMISSIONS,
  tools: [createExercise],
  cardKinds: ['cloze', 'quiz_choice'],
};
