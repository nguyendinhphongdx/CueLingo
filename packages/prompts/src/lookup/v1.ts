import { LookupRequestSchema, LookupResponseSchema, type LookupRequest } from '@cuelingo/shared';
import { languageHasReading, promptLanguage } from '../language';

export const LOOKUP_PROMPT_VERSION = 'assist.lookup@v1';
export const LookupOutputSchema = LookupResponseSchema.refine(
  ({ exampleEn }) =>
    typeof exampleEn === 'string' && exampleEn.trim().length > 0 && exampleEn.length <= 200,
  { path: ['exampleEn'], message: 'A short example is required' },
);

const system = (language: string, reading: boolean) =>
  [
    `You help a Vietnamese professional understand ${language} used in a business meeting.`,
    'Return only one valid JSON object with these fields:',
    '- term: the requested term as used in context',
    '- pos: a short English part of speech when clear (optional)',
    ...(reading ? ['- reading: how the term is read aloud, in hiragana (optional)'] : []),
    '- meaningVi: a concise Vietnamese meaning that fits the context',
    `- exampleEn: one short, natural ${language} example using the same meaning`,
    '- noteVi: a brief nuance or usage note in Vietnamese when useful (optional)',
    'Do not add Markdown, commentary, or fields outside the JSON object.',
  ].join('\n');

export function buildLookupPrompt(input: LookupRequest) {
  const { term, context, language } = LookupRequestSchema.parse(input);
  const parts = [`Term:\n${term}`];
  if (context) parts.push(`Meeting context:\n${context}`);
  return {
    system: system(promptLanguage(language), languageHasReading(language)),
    prompt: parts.join('\n\n'),
  };
}
