import type { MeetingAnswerSource } from '@cuelingo/shared';

const TAG = /\[(G|\d{1,2})((?:\s*,\s*(?:G|\d{1,2}))*)\]/g;

/**
 * The sources shown under an answer. `available[n - 1]` is what the server really put in the prompt as source
 * `[n]`; a number outside that list is the model's invention and is dropped. An answer that cites nothing real
 * is labelled as general knowledge, so it is never presented as coming from the person's data.
 */
export function citedSources(
  answer: string,
  available: MeetingAnswerSource[],
): MeetingAnswerSource[] {
  if (!answer.trim()) return [];
  const numbers = new Set<number>();
  let general = false;
  for (const match of answer.matchAll(TAG)) {
    for (const tag of `${match[1]}${match[2]}`.split(',').map((part) => part.trim())) {
      if (tag === 'G') general = true;
      else if (available[Number(tag) - 1]) numbers.add(Number(tag) - 1);
    }
  }
  const cited = [...numbers].sort((a, b) => a - b).map((index) => available[index]!);
  if (general || cited.length === 0) cited.push({ kind: 'general' });
  return cited;
}
