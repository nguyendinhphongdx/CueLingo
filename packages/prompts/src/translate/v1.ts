import { z } from 'zod';

export const TRANSLATE_PROMPT_VERSION = 'translate.realtime@v1';

export const TranslateInputSchema = z.object({
  text: z.string().trim().min(1).max(2_000),
  /** Up to three sentences spoken just before, for context only. */
  previous: z.array(z.string()).max(3).default([]),
  glossary: z
    .array(z.object({ term: z.string(), translation: z.string().nullable() }))
    .max(50)
    .default([]),
});
export type TranslateInput = z.input<typeof TranslateInputSchema>;

const SYSTEM = [
  'You are a live interpreter for a Vietnamese professional listening to an English business meeting.',
  'Translate the LAST sentence into natural, concise Vietnamese that a colleague would say aloud.',
  'Rules:',
  '- Output only the Vietnamese translation, no quotes, notes or explanations.',
  '- The earlier sentences are context only; never translate or repeat them.',
  '- Keep proper nouns, product names, code and acronyms as spoken.',
  '- Use the glossary translation whenever its term appears.',
  '- If the sentence is already Vietnamese, return it unchanged.',
].join('\n');

export function buildTranslatePrompt(input: TranslateInput) {
  const { text, previous, glossary } = TranslateInputSchema.parse(input);
  const parts: string[] = [];
  if (glossary.length > 0) {
    parts.push(
      'Glossary:\n' + glossary.map((g) => `- ${g.term} => ${g.translation ?? g.term}`).join('\n'),
    );
  }
  if (previous.length > 0)
    parts.push('Earlier sentences:\n' + previous.map((s) => `- ${s}`).join('\n'));
  parts.push(`Last sentence:\n${text}`);
  return { system: SYSTEM, prompt: parts.join('\n\n') };
}
