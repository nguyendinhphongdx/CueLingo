import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MeetingAnswer, meetingSourceLabel } from './meeting-answer';

describe('MeetingAnswer', () => {
  it('names every kind of source and marks general knowledge as unchecked (AC11)', () => {
    expect(meetingSourceLabel({ kind: 'current_meeting' })).toBe('Cuộc họp này');
    expect(
      meetingSourceLabel({
        kind: 'past_meeting',
        sessionId: 's',
        title: 'Planning',
        startedAt: '2026-11-20T03:00:00.000Z',
      }),
    ).toBe('Cuộc họp “Planning”, 20/11/2026');
    expect(meetingSourceLabel({ kind: 'general' })).toContain('chưa kiểm chứng');
  });

  it('hides source markers, including one cut in half while streaming', () => {
    const markup = renderToStaticMarkup(
      <MeetingAnswer question="q" text="Ngân sách 20k [1] và [" status="answering" />,
    );
    expect(markup).toContain('Ngân sách 20k và');
    expect(markup).not.toContain('[');
  });

  it('offers stop while answering, retry on error and more detail when done (AC4, AC7, AC14)', () => {
    const actions = { onStop: vi.fn(), onRetry: vi.fn(), onMore: vi.fn() };
    const render = (status: 'answering' | 'complete' | 'error') =>
      renderToStaticMarkup(<MeetingAnswer question="q" text="a" status={status} {...actions} />);
    expect(render('answering')).toContain('Dừng');
    expect(render('error')).toContain('Thử lại');
    expect(render('complete')).toContain('Giải thích thêm');
    expect(render('complete')).not.toContain('Thử lại');
  });
});
