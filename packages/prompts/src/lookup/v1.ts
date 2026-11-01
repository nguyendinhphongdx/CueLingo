import { LookupRequestSchema, LookupResponseSchema, type LookupRequest } from '@cuelingo/shared';

export const LOOKUP_PROMPT_VERSION = 'assist.lookup@v1';
export const LookupOutputSchema = LookupResponseSchema.refine(
  ({ exampleEn }) =>
    typeof exampleEn === 'string' && exampleEn.trim().length > 0 && exampleEn.length <= 200,
  { path: ['exampleEn'], message: 'A short English example is required' },
);

const SYSTEM = [
  'You help a Vietnamese professional understand English used in a business meeting.',
  'Return only one valid JSON object with these fields:',
  '- term: the requested term as used in context',
  '- pos: a short English part of speech when clear (optional)',
  '- meaningVi: a concise Vietnamese meaning that fits the context',
  '- exampleEn: one short, natural English example using the same meaning',
  '- noteVi: a brief nuance or usage note in Vietnamese when useful (optional)',
  'Do not add Markdown, commentary, or fields outside the JSON object.',
].join('\n');

export function buildLookupPrompt(input: LookupRequest) {
  const { term, context } = LookupRequestSchema.parse(input);
  const parts = [`Term:\n${term}`];
  if (context) parts.push(`Meeting context:\n${context}`);
  return { system: SYSTEM, prompt: parts.join('\n\n') };
}
