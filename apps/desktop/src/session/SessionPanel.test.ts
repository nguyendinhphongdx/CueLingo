import { beforeEach, describe, expect, it, vi } from 'vitest';

const nativeMocks = vi.hoisted(() => ({
  sessionStart: vi.fn(),
  sessionStop: vi.fn(),
  toggleOverlay: vi.fn(),
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

  it('maps known and unknown native errors to Vietnamese messages', async () => {
    const { describeNativeError } = await import('./session-actions');

    expect(describeNativeError('session_already_running')).toContain('Một phiên đang chạy');
    expect(describeNativeError(new Error('invalid_assist_level'))).toContain('không hợp lệ');
    expect(describeNativeError('unexpected')).toBe('CueLingo gặp lỗi. Vui lòng thử lại.');
  });
});
