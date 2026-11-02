import { ComposeRequestSchema, ComposeResponseSchema, type ComposeRequest } from '@cuelingo/shared';
import { promptLanguage, withArticle } from '../language';

export const COMPOSE_PROMPT_VERSION = 'assist.compose@v1';
export const ComposeOutputSchema = ComposeResponseSchema.refine(
  ({ options }) => options.length === 2,
  {
    path: ['options'],
    message: 'Exactly two options are required',
  },
);

const system = (language: string) =>
  [
    `You help a Vietnamese professional speak naturally in ${withArticle(language)} business meeting.`,
    'Return only one valid JSON object with an options array containing exactly two choices.',
    'Each choice has:',
    `- en: a polite, concise ${language} sentence that can be spoken immediately (the field is named en whatever the language)`,
    '- noteVi: a very short Vietnamese tone note when useful (optional)',
    'Keep both choices faithful to the intent but vary their wording. Do not add Markdown or extra fields.',
  ].join('\n');

export function buildComposePrompt(input: ComposeRequest) {
  const { intentVi, context, language } = ComposeRequestSchema.parse(input);
  const parts: string[] = [];
  if (context?.length)
    parts.push(`Recent meeting context:\n${context.map((line) => `- ${line}`).join('\n')}`);
  parts.push(`Vietnamese intent:\n${intentVi}`);
  return { system: system(promptLanguage(language)), prompt: parts.join('\n\n') };
}
