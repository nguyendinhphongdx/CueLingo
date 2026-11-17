import { describe, expect, it } from 'vitest';
import { MAX_BULK_TERMS, parseBulkTerms } from './bulk';

describe('parseBulkTerms', () => {
  it('takes one term per line, with an optional translation after a separator', () => {
    const { entries, skipped } = parseBulkTerms(
      'Sprint review - Buổi tổng kết\nroadmap\tlộ trình\n\n  OKR | mục tiêu  \nbacklog',
    );
    expect(entries).toEqual([
      { term: 'Sprint review', translation: 'Buổi tổng kết' },
      { term: 'roadmap', translation: 'lộ trình' },
      { term: 'OKR', translation: 'mục tiêu' },
      { term: 'backlog', translation: null },
    ]);
    expect(skipped).toBe(0);
  });

  it('keeps hyphens inside a word and drops duplicates, existing terms and overlong lines', () => {
    const { entries, skipped } = parseBulkTerms(
      ['follow-up', 'Follow-Up', 'roadmap', 'x'.repeat(121)].join('\n'),
      [{ term: 'Roadmap' }],
    );
    expect(entries).toEqual([{ term: 'follow-up', translation: null }]);
    expect(skipped).toBe(3);
  });

  it('stops at the limit and says how many lines were left', () => {
    const text = Array.from({ length: MAX_BULK_TERMS + 3 }, (_, i) => `term ${i}`).join('\n');
    const result = parseBulkTerms(text);
    expect(result.entries).toHaveLength(MAX_BULK_TERMS);
    expect(result.overLimit).toBe(3);
  });
});
