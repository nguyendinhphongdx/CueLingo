import type { Debrief } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  BRIEF_DENIED_TEXT,
  BRIEF_EMPTY_TEXT,
  BRIEF_TIMEOUT_TEXT,
  PostMeetingCard,
} from './PostMeetingCard';

vi.mock('../lib/native', () => ({ native: {} }));

const id = '6df65d24-949f-4456-b5d2-4394c9d7ae16';
const debrief: Debrief = {
  id,
  sessionId: id,
  version: 1,
  createdAt: '2026-11-03T01:00:00.000Z',
  summary: { headlineVi: 'Chốt kế hoạch', bulletsVi: ['ý một'] },
  actionItems: [
    { textVi: 'Dùng Postgres', kind: 'decision' },
    ...['a', 'b', 'c', 'd', 'e'].map((t) => ({ textVi: `việc ${t}`, kind: 'todo' as const })),
  ],
  hardSegmentIds: [],
  phraseSuggestions: [],
  rephrase: [],
  comprehensionPct: null,
};
const render = (brief: Parameters<typeof PostMeetingCard>[0]['brief'], sentences = 42) =>
  renderToStaticMarkup(
    <PostMeetingCard
      duration="12:34"
      sentences={sentences}
      brief={brief}
      onOpen={() => undefined}
    />,
  );

describe('PostMeetingCard', () => {
  it('shows duration, sentences, a spinner and the full-view button while waiting', () => {
    const markup = render({ status: 'pending' });
    expect(markup).toContain('Cuộc họp vừa xong');
    expect(markup).toContain('12:34');
    expect(markup).toContain('42 câu');
    expect(markup).toContain('Đang tạo debrief…');
    expect(markup).toContain('animate-spin');
    expect(markup).toContain('Xem đầy đủ');
  });

  it('shows summary, decisions and capped to-dos when ready', () => {
    const markup = render({ status: 'ready', debrief });
    expect(markup).toContain('Chốt kế hoạch');
    expect(markup).toContain('Dùng Postgres');
    expect(markup).toContain('việc c');
    expect(markup).not.toContain('việc d');
    expect(markup).toContain('và 2 mục khác');
    expect(markup).not.toContain('Đang tạo debrief');
  });

  it('shows only the summary when there are no decisions or actions', () => {
    const markup = render({ status: 'ready', debrief: { ...debrief, actionItems: [] } });
    expect(markup).toContain('Chốt kế hoạch');
    expect(markup).not.toContain('Quyết định');
    expect(markup).not.toContain('Việc cần làm');
  });

  it('tells the person where to look after a timeout', () => {
    expect(render({ status: 'timeout' })).toContain(BRIEF_TIMEOUT_TEXT);
  });

  it('says there is no debrief for a meeting with no sentences, with no spinner or button', () => {
    const markup = render({ status: 'pending' }, 0);
    expect(markup).toContain(BRIEF_EMPTY_TEXT);
    expect(markup).not.toContain('Đang tạo debrief');
    expect(markup).not.toContain('Xem đầy đủ');
  });

  it('asks the person to sign in again when the debrief is forbidden', () => {
    expect(render({ status: 'denied' })).toContain(BRIEF_DENIED_TEXT);
  });
});
