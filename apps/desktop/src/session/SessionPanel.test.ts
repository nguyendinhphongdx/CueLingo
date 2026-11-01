import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DebriefButton, SessionStatus } from './SessionPanel';

const nativeMocks = vi.hoisted(() => ({
  sessionStart: vi.fn(),
  sessionStop: vi.fn(),
  toggleOverlay: vi.fn(),
  openUrl: vi.fn(),
}));

vi.mock('../lib/native', () => ({ native: nativeMocks }));

describe('SessionPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts and stops a session through native', async () => {
    const { startSession, stopSession } = await import('./session-actions');

    await startSession(3);
    await stopSession();

    expect(nativeMocks.sessionStart).toHaveBeenCalledWith({ assistLevel: 3 });
    expect(nativeMocks.sessionStop).toHaveBeenCalledOnce();
  });

  it('toggles the overlay through native', async () => {
    const { toggleOverlay } = await import('./session-actions');
    await toggleOverlay();
    expect(nativeMocks.toggleOverlay).toHaveBeenCalledOnce();
  });

  it('renders the debrief button and opens the session in the configured web app', async () => {
    const sessionId = '6df65d24-949f-4456-b5d2-4394c9d7ae16';
    const markup = renderToStaticMarkup(createElement(DebriefButton, { sessionId }));
    const { openDebrief } = await import('./session-actions');

    await openDebrief(sessionId);

    expect(markup).toContain('Xem debrief');
    expect(nativeMocks.openUrl).toHaveBeenCalledWith(`http://localhost:3000/sessions/${sessionId}`);
  });

  it('maps known and unknown native errors to Vietnamese messages', async () => {
    const { describeNativeError } = await import('./session-actions');

    expect(describeNativeError('session_already_running')).toContain('Một phiên đang chạy');
    expect(describeNativeError(new Error('invalid_assist_level'))).toContain('không hợp lệ');
    expect(describeNativeError('unexpected')).toBe('CueLingo gặp lỗi. Vui lòng thử lại.');
  });

  it('renders every session status including the reconnect message in Vietnamese', () => {
    const statuses = ['idle', 'connecting', 'running', 'reconnecting', 'error'] as const;
    const markup = statuses.map((status) =>
      renderToStaticMarkup(createElement(SessionStatus, { status })),
    );

    expect(markup.join(' ')).toContain('Chưa bắt đầu');
    expect(markup.join(' ')).toContain('Đang kết nối…');
    expect(markup.join(' ')).toContain('Đang chạy');
    expect(markup.join(' ')).toContain('Đang kết nối lại…');
    expect(markup.join(' ')).toContain('Có lỗi');
  });
});
