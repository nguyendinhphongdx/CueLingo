import { describe, expect, it } from 'vitest';
import { cleanWord, isSaved, savedSet, sentenceAround } from './word-selection';

describe('cleanWord', () => {
  it('trims the space and punctuation a double-click can include', () => {
    expect(cleanWord('follow ')).toBe('follow');
    expect(cleanWord('“circle,”')).toBe('circle');
    expect(cleanWord("don't")).toBe("don't");
    expect(cleanWord('  tiếng  Việt ')).toBe('tiếng Việt');
  });
  it('refuses empty, symbol-only and overlong selections', () => {
    expect(cleanWord('   ')).toBeNull();
    expect(cleanWord('--- ***')).toBeNull();
    expect(cleanWord('a'.repeat(81))).toBeNull();
  });
});

describe('sentenceAround', () => {
  const text = 'First sentence. Could we circle back on this? Sure, thanks!';
  const at = (word: string) => {
    const start = text.indexOf(word);
    return sentenceAround(text, start, start + word.length);
  };

  it('returns the sentence that contains the word', () => {
    expect(at('circle')).toBe('Could we circle back on this?');
    expect(at('First')).toBe('First sentence.');
    expect(at('thanks')).toBe('Sure, thanks!');
  });

  it('stops at line breaks (list items, paragraphs)', () => {
    const multi = 'Intro line\nUse touch base weekly\nOutro';
    const start = multi.indexOf('touch');
    expect(sentenceAround(multi, start, start + 5)).toBe('Use touch base weekly');
  });

  it('does not split on a dot with no space after it', () => {
    const t = 'Use e.g.the tool here. Next.';
    const start = t.indexOf('tool');
    expect(sentenceAround(t, start, start + 4)).toBe('Use e.g.the tool here.');
  });

  it('keeps a very long sentence to 500 characters around the word', () => {
    const long = `${'word '.repeat(300)}target ${'word '.repeat(300)}`;
    const start = long.indexOf('target');
    const sentence = sentenceAround(long, start, start + 6);
    expect(sentence.length).toBeLessThanOrEqual(500);
    expect(sentence).toContain('target');
  });
});

describe('saved phrases', () => {
  it('compares with normalizePhrase: case and spacing do not matter', () => {
    const saved = savedSet([{ phrase: 'Follow  Up' }, { phrase: 'touch base' }]);
    expect(isSaved(saved, 'follow up')).toBe(true);
    expect(isSaved(saved, 'TOUCH   BASE')).toBe(true);
    expect(isSaved(saved, 'circle back')).toBe(false);
  });
});
