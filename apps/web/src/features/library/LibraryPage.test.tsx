import type { Session } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionList } from './LibraryPage';

const session = (overrides: Partial<Session> = {}): Session => ({
  id: '74cd2b16-1bd2-4c46-9ed4-b1f1bc376f31',
  title: 'Weekly sync',
  startedAt: '2026-11-01T08:00:00.000Z',
  endedAt: '2026-11-01T08:30:00.000Z',
  status: 'ended',
  assistLevel: 2,
  ...overrides,
});

describe('SessionList', () => {
  it('shows guidance when there are no sessions', () => {
    const markup = renderToStaticMarkup(<SessionList sessions={[]} />);
    expect(markup).toContain('Chưa có cuộc họp nào');
    expect(markup).toContain('ứng dụng desktop');
  });

  it('shows title, duration, status and a detail link', () => {
    const markup = renderToStaticMarkup(<SessionList sessions={[session()]} />);
    expect(markup).toContain('Weekly sync');
    expect(markup).toContain('30 phút');
    expect(markup).toContain('Đang xử lý debrief…');
    expect(markup).toContain('/sessions/74cd2b16-1bd2-4c46-9ed4-b1f1bc376f31');
  });

  it('orders the newest session first', () => {
    const markup = renderToStaticMarkup(
      <SessionList
        sessions={[
          session({ title: 'Cuộc họp cũ' }),
          session({
            id: '8047dd55-7423-4a34-a5f7-a75fe0cc8821',
            title: 'Cuộc họp mới',
            startedAt: '2026-11-02T08:00:00.000Z',
            endedAt: '2026-11-02T08:20:00.000Z',
          }),
        ]}
      />,
    );
    expect(markup.indexOf('Cuộc họp mới')).toBeLessThan(markup.indexOf('Cuộc họp cũ'));
  });
});
