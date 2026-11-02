import { answerUnits, foldWidth, usesSpaces } from './text-units';

/** Comparing what someone typed after hearing a phrase with the phrase itself. Pure; spaced languages compare words, others characters. */

/** Lower case, accents and punctuation removed, spaces collapsed: "Push-back!" and "push back" match. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const isSameText = (typed: string, answer: string, language = 'en'): boolean =>
  usesSpaces(language)
    ? normalizeText(typed) === normalizeText(answer)
    : answerUnits(typed, language).join('') === answerUnits(answer, language).join('');

export type WordState = 'ok' | 'wrong';

export interface AnswerWord {
  word: string;
  state: WordState;
}

/**
 * The words of the answer, each marked right (it appears in the typed text, in order) or wrong (it
 * was missed or misspelled). Uses the longest common subsequence so one slip does not flag the rest.
 */
export function markAnswerWords(typed: string, answer: string, language = 'en'): AnswerWord[] {
  const shown = answerUnits(answer, language);
  const fold = (unit: string) => (usesSpaces(language) ? normalizeText(unit) : foldWidth(unit));
  const want = shown.map(fold);
  const have = usesSpaces(language)
    ? normalizeText(typed).split(' ').filter(Boolean)
    : answerUnits(typed, language).map(fold);

  const table = Array.from({ length: want.length + 1 }, () =>
    new Array<number>(have.length + 1).fill(0),
  );
  for (let i = want.length - 1; i >= 0; i -= 1) {
    for (let j = have.length - 1; j >= 0; j -= 1) {
      table[i]![j] =
        want[i] === have[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }

  const result: AnswerWord[] = [];
  let i = 0;
  let j = 0;
  while (i < want.length) {
    if (j < have.length && want[i] === have[j]) {
      result.push({ word: shown[i]!, state: 'ok' });
      i += 1;
      j += 1;
    } else if (j < have.length && table[i]![j + 1]! >= table[i + 1]![j]!) {
      j += 1;
    } else {
      result.push({ word: shown[i]!, state: 'wrong' });
      i += 1;
    }
  }
  return result;
}
