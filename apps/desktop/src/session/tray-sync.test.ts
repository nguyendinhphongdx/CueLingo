import { describe, expect, it, vi } from 'vitest';
import type { SessionSnapshot } from './session-controller';
import { startTraySync, trayViewOf } from './tray-sync';

const snap = (over: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  status: 'running',
  error: null,
  completedSessionId: null,
  completedSegmentCount: 0,
  startedAt: 0,
  endedAt: null,
  micFailed: false,
  systemFailed: false,
  suggestedLanguage: null,
  meetingLanguage: 'en',
  ...over,
});

describe('trayViewOf', () => {
  it('reports no meeting when this window has none (AC4)', () => {
    expect(trayViewOf(snap({ status: 'idle' }), 9e6)).toEqual({ active: false, minutes: 0 });
  });

  it('does not claim idle for an error state: the native side keeps the icon live (AC2)', () => {
    // 'error' can come mid-meeting with capture still on; this window then reports nothing more.
    expect(trayViewOf(snap({ status: 'error', micFailed: true }), 9e6)).toEqual({
      active: false,
      minutes: 0,
    });
  });

  it('reports whole minutes while connecting, running, reconnecting and draining (AC2)', () => {
    expect(trayViewOf(snap(), 125_000)).toEqual({ active: true, minutes: 2 });
    for (const status of ['connecting', 'reconnecting'] as const) {
      expect(trayViewOf(snap({ status }), 0).active).toBe(true);
    }
    expect(trayViewOf(snap({ endedAt: 60_000 }), 9e6).minutes).toBe(1);
  });

  it('names the stream that failed (AC3)', () => {
    expect(trayViewOf(snap({ micFailed: true }), 0)).toMatchObject({ problem: 'mic' });
    expect(trayViewOf(snap({ systemFailed: true }), 0)).toMatchObject({ problem: 'system' });
    expect(trayViewOf(snap({ micFailed: true, systemFailed: true }), 0).problem).toBe('both');
  });

  it('carries nothing from the meeting (AC7)', () => {
    const view = trayViewOf(snap({ completedSessionId: 'secret-id', meetingLanguage: 'ko' }), 0);
    expect(Object.keys(view).sort()).toEqual(['active', 'minutes']);
  });
});

describe('startTraySync', () => {
  const setup = () => {
    let current = snap({ status: 'idle' });
    const listeners = new Set<() => void>();
    let onStop: () => void = () => undefined;
    const controller = {
      getSnapshot: () => current,
      subscribe: (l: () => void) => (listeners.add(l), () => listeners.delete(l)),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    const native = {
      trayReport: vi.fn().mockResolvedValue(undefined),
      onTrayStop: vi
        .fn()
        .mockImplementation(async (cb: () => void) => ((onStop = cb), () => undefined)),
    };
    const change = (next: SessionSnapshot) => {
      current = next;
      listeners.forEach((l) => l());
    };
    return { controller, native, change, fireStop: () => onStop() };
  };

  it('sends only changes and moves the minute with the clock', async () => {
    vi.useFakeTimers();
    const { controller, native, change } = setup();
    const stop = startTraySync(controller, native, () => Date.now());
    await vi.advanceTimersByTimeAsync(0);
    expect(native.trayReport).toHaveBeenLastCalledWith({ active: false, minutes: 0 });
    change(snap({ status: 'idle' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(native.trayReport).toHaveBeenCalledTimes(1);
    change(snap({ startedAt: Date.now() }));
    await vi.advanceTimersByTimeAsync(0);
    expect(native.trayReport).toHaveBeenLastCalledWith({ active: true, minutes: 0 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(native.trayReport).toHaveBeenLastCalledWith({ active: true, minutes: 1 });
    stop();
    vi.useRealTimers();
  });

  it('stops the meeting when the menu item is chosen (AC5)', async () => {
    const { controller, native, change, fireStop } = setup();
    const stop = startTraySync(controller, native);
    await new Promise((resolve) => setTimeout(resolve, 0));
    change(snap());
    fireStop();
    expect(controller.stop).toHaveBeenCalledOnce();
    stop();
  });

  it('ignores the menu item while the meeting is still starting, like the panel button', async () => {
    const { controller, native, change, fireStop } = setup();
    const stop = startTraySync(controller, native);
    await new Promise((resolve) => setTimeout(resolve, 0));
    change(snap({ status: 'connecting' }));
    fireStop();
    expect(controller.stop).not.toHaveBeenCalled();
    stop();
  });

  it('tries again after a failed update and never throws', async () => {
    vi.useFakeTimers();
    const { controller, native } = setup();
    native.trayReport.mockRejectedValueOnce(new Error('tray_missing'));
    const stop = startTraySync(controller, native);
    await vi.advanceTimersByTimeAsync(0);
    expect(native.trayReport).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(native.trayReport).toHaveBeenCalledTimes(2);
    stop();
    vi.useRealTimers();
  });
});
