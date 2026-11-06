import { defineTool, type AgentPermission, type AgentPlugin } from '@cuelingo/agent';
import { AgentCardSchema, LookupResponseSchema, type AgentCardKind } from '@cuelingo/shared';
import { z } from 'zod';
import type { CoreCapabilities } from './capabilities';

export const CORE_PLUGIN_ID = 'core';
export const CORE_PERMISSIONS: AgentPermission[] = [
  'phrases:read',
  'phrases:write',
  'lookup',
  'cards',
];

/** Kinds of `AgentCardSchema`, in declaration order, for the `show_card` tool's `kind` enum. */
const CARD_KINDS = AgentCardSchema.options.map((option) => option.shape.kind.value) as [
  AgentCardKind,
  ...AgentCardKind[],
];

/** Most phrases `list_saved_phrases` returns: the model needs a sample, not the whole Phrase Bank. */
const MAX_LISTED_PHRASES = 30;

const lookupWord = defineTool<
  CoreCapabilities,
  { term: string; context?: string },
  z.infer<typeof LookupResponseSchema>
>({
  name: 'lookup_word',
  description:
    'Look up a word or phrase: part of speech, Vietnamese meaning, an example and a note. Pass the sentence it appeared in as context when you have one.',
  kind: 'read',
  input: z.object({
    term: z.string().trim().min(1).max(80),
    context: z.string().trim().max(600).optional(),
  }),
  output: LookupResponseSchema,
  run: (input, ctx) => ctx.capabilities.lookup(input),
  summarize: (output) => `Đã tra nghĩa "${output.term}"`,
});

const listSavedPhrases = defineTool<
  CoreCapabilities,
  { limit?: number },
  { total: number; phrases: Array<{ phrase: string; meaningVi: string | null }> }
>({
  name: 'list_saved_phrases',
  description: `Read the phrases the user has saved in their Phrase Bank (at most ${MAX_LISTED_PHRASES}).`,
  kind: 'read',
  input: z.object({ limit: z.number().int().min(1).max(MAX_LISTED_PHRASES).optional() }),
  output: z.object({
    total: z.number().int().min(0),
    phrases: z.array(z.object({ phrase: z.string(), meaningVi: z.string().nullable() })),
  }),
  async run(input, ctx) {
    const all = await ctx.capabilities.listPhrases();
    const phrases = all
      .slice(0, input.limit ?? MAX_LISTED_PHRASES)
      .map(({ phrase, meaningVi }) => ({ phrase, meaningVi }));
    return { total: all.length, phrases };
  },
  summarize: (output) => `Đã đọc ${output.phrases.length}/${output.total} cụm từ đã lưu`,
});

const savePhrase = defineTool<
  CoreCapabilities,
  { phrase: string; meaningVi?: string; context?: string },
  { phrase: string; meaningVi: string | null; inReview: boolean }
>({
  name: 'save_phrase',
  description:
    "Save a phrase to the user's Phrase Bank for review. Only when the user asked for it or confirmed. Pass the Vietnamese meaning and the sentence it was read in when you have them.",
  kind: 'write',
  input: z.object({
    phrase: z.string().trim().min(1).max(200),
    meaningVi: z.string().trim().max(500).optional(),
    context: z.string().trim().max(500).optional(),
  }),
  output: z.object({
    phrase: z.string(),
    meaningVi: z.string().nullable(),
    inReview: z.boolean(),
  }),
  async run(input, ctx) {
    const saved = await ctx.capabilities.savePhrase(input);
    return { phrase: saved.phrase, meaningVi: saved.meaningVi, inReview: saved.inReview };
  },
  summarize: (output) => `Đã lưu "${output.phrase}" vào Phrase Bank`,
});

const showCard = defineTool<
  CoreCapabilities,
  { kind: string; data: Record<string, unknown> },
  { shown: boolean; card?: z.infer<typeof AgentCardSchema>; problem?: string }
>({
  name: 'show_card',
  description:
    'Show the user an interactive card instead of plain text. kind is one of ' +
    `${CARD_KINDS.join(', ')}; data has the shape described in the instructions for that kind.`,
  kind: 'read',
  // A loose object on purpose: a union at the root of a tool schema is not accepted by every provider.
  // `run` validates against the real `AgentCardSchema` and tells the model what to fix.
  input: z.object({
    kind: z.enum(CARD_KINDS),
    data: z.record(z.string(), z.unknown()),
  }),
  output: z.object({
    shown: z.boolean(),
    card: AgentCardSchema.optional(),
    problem: z.string().max(200).optional(),
  }),
  async run(input) {
    const parsed = AgentCardSchema.safeParse({ kind: input.kind, data: input.data });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path.slice(1).join('.') || 'data';
      return { shown: false, problem: `${where}: ${issue?.message ?? 'invalid'}`.slice(0, 200) };
    }
    return { shown: true, card: parsed.data };
  },
  toCard: (output) => output.card,
  summarize: (output) =>
    output.shown
      ? `Đã hiển thị thẻ ${output.card?.kind ?? ''}`.trim()
      : 'Thẻ chưa hợp lệ, đã bỏ qua',
});

/** The built-in plugin: look a word up, read and save phrases, show a card. */
export const corePlugin: AgentPlugin<CoreCapabilities> = {
  id: CORE_PLUGIN_ID,
  version: '1.0.0',
  permissions: CORE_PERMISSIONS,
  tools: [lookupWord, listSavedPhrases, savePhrase, showCard],
  cardKinds: [...CARD_KINDS],
};

export type { CoreCapabilities, CoreServices } from './capabilities';
export { buildCoreCapabilities, scopeCapabilities } from './capabilities';
