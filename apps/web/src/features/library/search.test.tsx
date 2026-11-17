import type { Session, SessionDetail } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionList } from './LibraryPage';
import { searchSessions } from '@cuelingo/ui/lib/meeting-search';

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

describe('SessionList with matches (AC10)', () => {
  it('shows the matching line with the word marked', () => {
    const hits = searchSessions([nov], details, { query: 'budget', month: '', speaker: '' });
    const markup = renderToStaticMarkup(<SessionList hits={hits} query="budget" />);
    expect(markup).toContain('<mark');
    expect(markup).toContain('>budget</mark>');
    expect(markup).toContain('Lan: ');
  });

  it('says nothing matched instead of "no meetings yet" when filters are on', () => {
    const markup = renderToStaticMarkup(<SessionList hits={[]} query="x" />);
    expect(markup).toContain('Chưa có cuộc họp nào');
  });
});
