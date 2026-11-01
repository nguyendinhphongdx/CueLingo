import { ComposeRequestSchema, ComposeResponseSchema, type ComposeRequest } from '@cuelingo/shared';

export const COMPOSE_PROMPT_VERSION = 'assist.compose@v1';
export const ComposeOutputSchema = ComposeResponseSchema.refine(
  ({ options }) => options.length === 2,
  {
    path: ['options'],
    message: 'Exactly two options are required',
  },
);

const SYSTEM = [
  'You help a Vietnamese professional speak naturally in an English business meeting.',
  'Return only one valid JSON object with an options array containing exactly two choices.',
  'Each choice has:',
  '- en: a polite, concise English sentence that can be spoken immediately',
  '- noteVi: a very short Vietnamese tone note when useful (optional)',
  'Keep both choices faithful to the intent but vary their wording. Do not add Markdown or extra fields.',
].join('\n');

export function buildComposePrompt(input: ComposeRequest) {
  const { intentVi, context } = ComposeRequestSchema.parse(input);
  const parts: string[] = [];
  if (context?.length)
    parts.push(`Recent meeting context:\n${context.map((line) => `- ${line}`).join('\n')}`);
  parts.push(`Vietnamese intent:\n${intentVi}`);
  return { system: SYSTEM, prompt: parts.join('\n\n') };
}
