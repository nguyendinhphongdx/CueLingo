import { describe, expect, it } from 'vitest';
import { scorePlacement } from './placement';

const answers = (right: number, of = 6) => Array.from({ length: of }, (_, index) => index < right);

describe('scorePlacement', () => {
  it('maps six passages to a level and a starting assist level', () => {
    expect(scorePlacement(answers(0))).toMatchObject({ listeningLevel: 'a2', assistDefault: 4 });
    expect(scorePlacement(answers(1))).toMatchObject({ listeningLevel: 'a2', assistDefault: 4 });
    expect(scorePlacement(answers(2))).toMatchObject({ listeningLevel: 'b1', assistDefault: 3 });
    expect(scorePlacement(answers(3))).toMatchObject({ listeningLevel: 'b1', assistDefault: 3 });
    expect(scorePlacement(answers(4))).toMatchObject({ listeningLevel: 'b2', assistDefault: 1 });
    expect(scorePlacement(answers(5))).toMatchObject({ listeningLevel: 'c1', assistDefault: 1 });
    expect(scorePlacement(answers(6))).toMatchObject({ listeningLevel: 'c1', assistDefault: 1 });
  });

  it('never starts someone with everything hidden', () => {
    expect(scorePlacement(answers(6)).assistDefault).not.toBe(0);
  });

  it('counts what was answered right and treats no answers as the beginner level', () => {
    expect(scorePlacement(answers(4))).toMatchObject({ correct: 4, total: 6 });
    expect(scorePlacement([])).toMatchObject({ correct: 0, total: 0, listeningLevel: 'a2' });
  });
});
