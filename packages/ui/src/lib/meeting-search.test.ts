import type { Session, SessionDetail } from '@cuelingo/shared';
import { describe, expect, it } from 'vitest';
import {
  findSnippets,
  highlight,
  monthKey,
  monthsOf,
  searchSessions,
  speakersOf,
} from './meeting-search';

const SPEAKER_ID = '11111111-1111-4111-8111-111111111111';
const session = (id: string, startedAt: string, title: string | null = null): Session => ({
  id,
  title,
  startedAt,
  endedAt: new Date(Date.parse(startedAt) + 1_800_000).toISOString(),
  status: 'debriefed',
  assistLevel: 2,
  language: 'en',
});
const detail = (base: Session, lines: [string, string | null, 'me' | 'lan'][]): SessionDetail => ({
  ...base,
  speakers: [{ id: SPEAKER_ID, label: 'speaker_1', displayName: 'Lan' }],
  segments: lines.map(([textEn, textVi, who], index) => ({
    id: `00000000-0000-4000-8000-00000000000${index}`,
    source: who === 'me' ? 'mic' : 'system',
    startMs: index * 1000,
    endMs: index * 1000 + 900,
    textEn,
    textVi,
    speakerId: who === 'lan' ? SPEAKER_ID : null,
  })),
});

const nov = session(
  'a0000000-0000-4000-8000-000000000001',
  '2026-11-03T08:00:00.000Z',
  'Weekly sync',
);
const oct = session('a0000000-0000-4000-8000-000000000002', '2026-10-20T08:00:00.000Z');
const details = new Map([
  [
    nov.id,
    detail(nov, [
      ['We need to ship the budget report', 'Cần gửi báo cáo ngân sách', 'lan'],
      ['Sounds good', null, 'me'],
    ]),
  ],
  [oct.id, detail(oct, [['The budget is approved', null, 'me']])],
]);

describe('search helpers (AC10)', () => {
  it('marks every match ignoring case, and leaves other text as it is', () => {
    expect(highlight('Budget and budget', 'BUDGET')).toEqual([
      { text: 'Budget', match: true },
      { text: ' and ', match: false },
      { text: 'budget', match: true },
    ]);
    expect(highlight('nothing', 'zzz')).toEqual([{ text: 'nothing', match: false }]);
    expect(highlight('same', '')).toEqual([{ text: 'same', match: false }]);
  });

  it('keys months by Vietnam time and lists them newest first', () => {
    expect(monthKey('2026-10-31T20:00:00.000Z')).toBe('2026-11');
    expect(monthsOf([oct, nov])).toEqual(['2026-11', '2026-10']);
  });

  it('finds lines in English or Vietnamese with who said them', () => {
    const lines = findSnippets(details.get(nov.id)!, 'ngân sách');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ speaker: 'Lan', text: 'Cần gửi báo cáo ngân sách' });
    expect(speakersOf(details.get(nov.id)!)).toEqual(['Lan', 'Tôi']);
  });

  it('filters by text, month and speaker together', () => {
    const base = { query: 'budget', month: '', speaker: '' };
    expect(searchSessions([nov, oct], details, base).map((hit) => hit.session.id)).toEqual([
      nov.id,
      oct.id,
    ]);
    expect(searchSessions([nov, oct], details, { ...base, month: '2026-10' })).toHaveLength(1);
    const byLan = searchSessions([nov, oct], details, { ...base, speaker: 'Lan' });
    expect(byLan.map((hit) => hit.session.id)).toEqual([nov.id]);
    const byMe = searchSessions([nov, oct], details, { ...base, speaker: 'Tôi' });
    expect(byMe.map((hit) => hit.session.id)).toEqual([oct.id]);
  });

  it('still matches a meeting by title when its text has not been read', () => {
    const hits = searchSessions([nov], new Map(), { query: 'weekly', month: '', speaker: '' });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.snippets).toEqual([]);
  });
});
