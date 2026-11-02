import { RecapRequestSchema, RecapResponseSchema, type RecapRequest } from '@cuelingo/shared';
import { promptLanguage } from '../language';

export const RECAP_PROMPT_VERSION = 'assist.recap@v1';
export const RecapOutputSchema = RecapResponseSchema.refine(
  ({ summaryVi }) => summaryVi.split(/[.!?]+(?:\s+|$)/).filter(Boolean).length <= 2,
  { path: ['summaryVi'], message: 'Summary must contain at most two sentences' },
);

const system = (language: string) =>
  [
    `You recap the latest lines of a business meeting, spoken in ${language}, for a Vietnamese listener.`,
    'Return only one valid JSON object with these fields:',
    '- summaryVi: a natural Vietnamese summary of at most two sentences',
    '- bulletsVi: zero to five short Vietnamese takeaways, without repeating the summary',
    'Use only facts in the supplied lines. Do not add Markdown, commentary, or extra fields.',
  ].join('\n');

export function buildRecapPrompt(input: RecapRequest) {
  const { sentences, language } = RecapRequestSchema.parse(input);
  const lines = sentences.map(({ speaker, text }) => `- ${speaker ? `${speaker}: ` : ''}${text}`);
  return {
    system: system(promptLanguage(language)),
    prompt: `Latest meeting lines:\n${lines.join('\n')}`,
  };
}
