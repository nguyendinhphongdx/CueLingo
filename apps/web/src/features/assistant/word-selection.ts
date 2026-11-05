import { normalizePhrase } from '@cuelingo/shared';

/** Longest context the API accepts for a saved phrase. */
export const MAX_CONTEXT_CHARS = 500;
const MAX_WORD_CHARS = 80;

/**
 * The word the person double-clicked, without the space or punctuation a browser may include in the
 * selection. Null when nothing readable is selected (only symbols, or too long to be a word).
 */
export function cleanWord(raw: string): string | null {
  const word = raw
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .replace(/\s+/g, ' ');
  if (!word || word.length > MAX_WORD_CHARS || !/[\p{L}\p{N}]/u.test(word)) return null;
  return word;
}

const SENTENCE_END = /[.!?。！？]/;

/**
 * The sentence of `text` that contains the range `[start, end)`. A sentence ends at . ! ? and at a line
 * break; one longer than the API limit is cut to a window around the word.
 */
export function sentenceAround(text: string, start: number, end: number): string {
  let from = start;
  while (from > 0) {
    const prev = text[from - 1] as string;
    if (prev === '\n' || (SENTENCE_END.test(prev) && /\s/.test(text[from] ?? ''))) break;
    from--;
  }
  let to = end;
  while (to < text.length && text[to] !== '\n') {
    to++;
    if (SENTENCE_END.test(text[to - 1] as string)) break;
  }
  const raw = text.slice(from, to);
  if (raw.trim().length <= MAX_CONTEXT_CHARS) return raw.trim();
  const middle = start - from - Math.floor((MAX_CONTEXT_CHARS - (end - start)) / 2);
  const left = Math.max(0, Math.min(middle, raw.length - MAX_CONTEXT_CHARS));
  return raw.slice(left, left + MAX_CONTEXT_CHARS).trim();
}

/** Phrases already saved, as `normalizePhrase` spellings, so "Follow  Up" counts as saved when "follow up" is. */
export function savedSet(phrases: Array<{ phrase: string }>): Set<string> {
  return new Set(phrases.map((p) => normalizePhrase(p.phrase)));
}

export const isSaved = (saved: Set<string>, word: string): boolean =>
  saved.has(normalizePhrase(word));
