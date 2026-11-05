import { describe, expect, it } from 'vitest';
import { isClozeCorrect, splitCloze } from './agent-card';

describe('isClozeCorrect', () => {
  it('ignores case, spacing and a final full stop', () => {
    expect(isClozeCorrect('  Follow   UP. ', 'follow up')).toBe(true);
    expect(isClozeCorrect('follow', 'follow up')).toBe(false);
  });
  it('never accepts an empty answer', () => {
    expect(isClozeCorrect('  ', '')).toBe(false);
  });
});

describe('splitCloze', () => {
  it('cuts at the first blank', () => {
    expect(splitCloze("Let's ___ next week.")).toEqual(["Let's ", ' next week.']);
    expect(splitCloze('no blank')).toEqual(['no blank', '']);
  });
});
