import type { MeetingAnswerSource } from '@cuelingo/shared';
import { describe, expect, it } from 'vitest';
import { citedSources } from './citations';

const current: MeetingAnswerSource = { kind: 'current_meeting' };
const glossary: MeetingAnswerSource = { kind: 'glossary' };
const general: MeetingAnswerSource = { kind: 'general' };

describe('citedSources (AC11)', () => {
  it('lists only the sources that are cited, once each', () => {
    expect(citedSources('a [2] b [2] c', [current, glossary])).toEqual([glossary]);
    expect(citedSources('a [2, 1]', [current, glossary])).toEqual([current, glossary]);
  });

  it('drops numbers that stand for nothing and marks general knowledge', () => {
    expect(citedSources('a [1] b [7]', [current])).toEqual([current]);
    expect(citedSources('a [1] b [G]', [current])).toEqual([current, general]);
  });

  it('never presents an answer without a real source as coming from the data', () => {
    expect(citedSources('Không có nhãn', [current])).toEqual([general]);
    expect(citedSources('bịa [3]', [])).toEqual([general]);
    expect(citedSources('  ', [current])).toEqual([]);
  });
});
