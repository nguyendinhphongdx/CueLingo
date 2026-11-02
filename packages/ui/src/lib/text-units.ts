/**
 * Splitting text the way a language is read. English separates words with spaces; Japanese does not,
 * so words come from the platform's dictionary-based `Intl.Segmenter` and typed answers are compared
 * character by character. Pure; `language` is a code such as `en` or `ja`.
 */

/** Languages written without spaces between words. */
const UNSPACED = new Set(['ja', 'zh', 'th']);

export const usesSpaces = (language: string): boolean => !UNSPACED.has(language);

export interface TextPart {
  text: string;
  /** A word someone could tap to look up (not a space or punctuation). */
  isWord: boolean;
}

/** Splits into words and the gaps between them. Falls back to a plain pattern where `Intl.Segmenter` is missing. */
export function splitParts(text: string, language = 'en'): TextPart[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(language, { granularity: 'word' });
    return [...segmenter.segment(text)].map((part) => ({
      text: part.segment,
      isWord: part.isWordLike === true,
    }));
  }
  return text
    .split(/([\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*)/u)
    .filter(Boolean)
    .map((part) => ({ text: part, isWord: /^[\p{L}\p{M}\p{N}]/u.test(part) }));
}

/** Folds width and compatibility forms (fullwidth letters, half-width kana) so typing matches the text. */
export const foldWidth = (text: string): string => text.normalize('NFKC');

/**
 * The units a typed answer is compared in: words for spaced languages, single characters (letters and
 * numbers only, punctuation dropped) for the others.
 */
export function answerUnits(text: string, language = 'en'): string[] {
  if (usesSpaces(language)) return text.trim().split(/\s+/).filter(Boolean);
  return [...foldWidth(text)].filter((char) => /[\p{L}\p{N}]/u.test(char));
}
