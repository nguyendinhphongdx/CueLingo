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

const hasSegmenterData = (language: string) =>
  typeof Intl !== 'undefined' &&
  'Segmenter' in Intl &&
  Intl.Segmenter.supportedLocalesOf([language]).length > 0;

describe.skipIf(!hasSegmenterData('zh'))(
  'splitParts for Chinese (needs Intl.Segmenter zh data)',
  () => {
    it('splits a sentence into dictionary words; punctuation is not a word', () => {
      const parts = splitParts('请在下周一之前把报价单发给我们。', 'zh');
      const words = parts.filter((part) => part.isWord).map((part) => part.text);
      expect(words.length).toBeGreaterThan(3);
      expect(words.every((word) => word.length < 8)).toBe(true);
      expect(words.join('')).toBe('请在下周一之前把报价单发给我们');
      expect(parts.at(-1)).toEqual({ text: '。', isWord: false });
    });
  },
);

describe.skipIf(!hasSegmenterData('ko'))(
  'splitParts for Korean (needs Intl.Segmenter ko data)',
  () => {
    it('splits on spaces and keeps particles attached', () => {
      const parts = splitParts('다음 주 회의에 참석합니다.', 'ko');
      const words = parts.filter((part) => part.isWord).map((part) => part.text);
      expect(words).toEqual(['다음', '주', '회의에', '참석합니다']);
      expect(parts.at(-1)).toEqual({ text: '.', isWord: false });
      expect(usesSpaces('ko')).toBe(true);
    });
  },
);

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
