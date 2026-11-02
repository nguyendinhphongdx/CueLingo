import { describe, expect, it } from 'vitest';
import { isSameText, markAnswerWords, normalizeText } from './dictation';

describe('isSameText', () => {
  it('ignores case, punctuation, accents and extra spaces', () => {
    expect(isSameText('  Push-back!  ', 'push back')).toBe(true);
    expect(isSameText('Let’s  circle back.', "let's circle back")).toBe(true);
    expect(isSameText('Café', 'cafe')).toBe(true);
  });

  it('still tells different words apart', () => {
    expect(isSameText('push back', 'push pack')).toBe(false);
    expect(isSameText('circle', 'circle back')).toBe(false);
    expect(isSameText('', 'x')).toBe(false);
  });

  it('normalises to a stable shape', () => {
    expect(normalizeText('A,  B!!')).toBe('a b');
  });
});

describe('markAnswerWords', () => {
  const states = (typed: string, answer: string) =>
    markAnswerWords(typed, answer).map(({ word, state }) => `${word}:${state}`);

  it('marks everything right for an exact answer', () => {
    expect(states('circle back', 'circle back')).toEqual(['circle:ok', 'back:ok']);
  });

  it('flags only the missed or misspelled word', () => {
    expect(states('circle bak', 'circle back')).toEqual(['circle:ok', 'back:wrong']);
    expect(states('back', 'circle back')).toEqual(['circle:wrong', 'back:ok']);
  });

  it('does not let one extra word spoil the rest', () => {
    expect(states('please circle back', 'circle back')).toEqual(['circle:ok', 'back:ok']);
  });

  it('marks all wrong when nothing was typed', () => {
    expect(states('', 'push back')).toEqual(['push:wrong', 'back:wrong']);
  });

  it('keeps the original spelling and punctuation of the answer for display', () => {
    expect(markAnswerWords('align with', 'Align with').map((w) => w.word)).toEqual([
      'Align',
      'with',
    ]);
  });
});
