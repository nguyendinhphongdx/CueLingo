import { describe, expect, it } from 'vitest';
import { isSameText, markAnswerWords } from './dictation';
import { answerUnits, splitParts, usesSpaces } from './text-units';

describe('splitParts', () => {
  it('keeps English words and the gaps between them', () => {
    expect(splitParts("Let's review.", 'en').map((part) => part.text)).toEqual([
      "Let's",
      ' ',
      'review',
      '.',
    ]);
  });

  it('finds words in Japanese, which has no spaces', () => {
    const parts = splitParts('来週の会議に参加します。', 'ja');
    const words = parts.filter((part) => part.isWord).map((part) => part.text);
    expect(words.length).toBeGreaterThan(2);
    expect(words.join('')).toBe('来週の会議に参加します');
    expect(parts.at(-1)).toEqual({ text: '。', isWord: false });
  });
});

describe('answerUnits', () => {
  it('uses words for spaced languages and characters for the others', () => {
    expect(answerUnits('push  back', 'en')).toEqual(['push', 'back']);
    expect(answerUnits('検討、します。', 'ja')).toEqual(['検', '討', 'し', 'ま', 'す']);
    expect(usesSpaces('ja')).toBe(false);
  });
});

describe('Japanese typed answers', () => {
  it('ignores punctuation, spaces and full or half width forms', () => {
    expect(isSameText('検討 します', '検討します。', 'ja')).toBe(true);
    expect(isSameText('ＡＢＣ１２３', 'ABC123', 'ja')).toBe(true);
    expect(isSameText('検討しました', '検討します', 'ja')).toBe(false);
  });

  it('marks the wrong characters, not the whole answer', () => {
    const marked = markAnswerWords('検討しました', '検討します', 'ja').map(
      ({ word, state }) => `${word}:${state}`,
    );
    expect(marked).toEqual(['検:ok', '討:ok', 'し:ok', 'ま:ok', 'す:wrong']);
  });
});
