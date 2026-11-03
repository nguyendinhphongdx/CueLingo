import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DebriefButton, isCloudMeeting, SessionStatus } from './SessionPanel';

const nativeMocks = vi.hoisted(() => ({
  sessionStart: vi.fn(),
  sessionStop: vi.fn(),
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

describe('cloud language UI', () => {
  it('shows the consent text and the sending badge in Vietnamese', async () => {
    const { CLOUD_CONSENT_TEXT, CloudSendingBadge } = await import('./SessionPanel');
    expect(CLOUD_CONSENT_TEXT).toContain('gửi tới Google');
    expect(CLOUD_CONSENT_TEXT).toContain('CueLingo không lưu âm thanh');
    expect(renderToStaticMarkup(createElement(CloudSendingBadge))).toContain(
      'Đang gửi âm thanh tới Google để nhận dạng',
    );
  });

  it('shows the sending badge from the meeting language, not from the stored setting', () => {
    expect(isCloudMeeting('vi')).toBe(true);
    expect(isCloudMeeting('en')).toBe(false);
    expect(isCloudMeeting(null)).toBe(false);
  });

  it('has no overlay button and no demo button, only the hint', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL('./SessionPanel.tsx', import.meta.url), 'utf8');
    expect(source).toContain('Overlay tự hiện khi bắt đầu và ẩn khi dừng. ⌘⇧L để ẩn/hiện tay.');
    expect(source).not.toContain('IconButton');
    expect(source).not.toContain('toggleOverlay');
    expect(source).not.toContain('Hiện/ẩn overlay');
    expect(source).not.toContain('Chạy thử caption');
  });
});
