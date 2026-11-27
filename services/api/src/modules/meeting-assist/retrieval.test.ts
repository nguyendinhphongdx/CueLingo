import { describe, expect, it } from 'vitest';
import { likePattern } from './meeting-assist.repository';
import { capPast, hasPastWords, keywords, matchTerms, rankPast, selectCurrent } from './retrieval';

describe('meeting retrieval rules', () => {
  it('takes names and Vietnamese syllable pairs, without filler words', () => {
    expect(keywords('Lần trước mình bàn gì về ngân sách Falcon?')).toEqual(
      expect.arrayContaining(['ngân sách', 'falcon']),
    );
    expect(keywords('What did we say about the rollout plan?')).toEqual(['rollout', 'plan']);
    expect(keywords('là gì thế?')).toEqual([]);
  });

  it('cuts Japanese, Chinese and Korean text into pairs and keeps at most eight keys', () => {
    expect(keywords('予算の件')).toEqual(expect.arrayContaining(['予算']));
    expect(keywords('サーバー移行')).toEqual(expect.arrayContaining(['移行']));
    expect(keywords('alpha bravo charlie delta echo foxtrot golf hotel india')).toHaveLength(8);
  });

  it('notices a question about the past', () => {
    expect(hasPastWords('Hôm trước chốt gì?')).toBe(true);
    expect(hasPastWords('SSO là gì?')).toBe(false);
  });

  it('treats wildcard characters as text', () => {
    expect(likePattern('50%_a\\')).toBe('%50\\%\\_a\\\\%');
  });

  it('keeps the tail of a long meeting plus older lines about the question, in order (AC8)', () => {
    const lines = Array.from(
      { length: 500 },
      (_, i) => `${i % 2 ? 'Me' : 'Others'}: line ${i} ${'x'.repeat(80)}`,
    );
    lines[3] = 'Others: the Falcon budget was cut';
    const selected = selectCurrent(lines, ['falcon']);
    expect(selected).toContain(lines[3]);
    expect(selected).toContain(lines[2]);
    expect(selected.at(-1)).toBe(lines[499]);
    expect(selected.indexOf(lines[3]!)).toBeLessThan(selected.indexOf(lines[499]!));
    expect(selected.join('').length).toBeLessThanOrEqual(14_000);
    expect(selected.length).toBeLessThan(500);
  });

  it('sends only the saved terms that occur in the talk (AC9)', () => {
    const terms = [{ term: 'SSO' }, { term: 'Falcon' }];
    expect(matchTerms(terms, (t) => t.term, 'we need sso today')).toEqual([{ term: 'SSO' }]);
  });

  it('needs two keys for an earlier meeting, one when the question points at the past', () => {
    const session = (id: string, startedAt: string) => ({
      id,
      title: null,
      startedAt,
      headline: null,
      debriefText: '',
    });
    const sessions = [session('a', '2026-01-02'), session('b', '2026-01-01')];
    const hits = [
      { sessionId: 'a', segmentId: '1', text: 'falcon only', translation: null },
      { sessionId: 'b', segmentId: '2', text: 'falcon budget', translation: null },
    ];
    const keys = ['falcon', 'budget'];
    expect(rankPast(sessions, hits, keys, false).map((m) => m.session.id)).toEqual(['b']);
    expect(rankPast(sessions, hits, keys, true).map((m) => m.session.id)).toEqual(['b', 'a']);
  });

  it('keeps earlier meetings inside their budget', () => {
    const lines = [Array.from({ length: 100 }, () => 'y'.repeat(100))];
    expect(capPast(lines)[0]!.join('').length).toBeLessThanOrEqual(4_000);
  });
});
