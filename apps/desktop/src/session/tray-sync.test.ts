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
  it('is idle with no time when no meeting runs (AC4)', () => {
    expect(trayViewOf(snap({ status: 'idle' }), 9e6)).toEqual({ state: 'idle', minutes: 0 });
    expect(trayViewOf(snap({ status: 'error' }), 9e6).state).toBe('idle');
  });

  it('is live with whole minutes, also while connecting, reconnecting and draining (AC2)', () => {
    expect(trayViewOf(snap(), 125_000)).toEqual({ state: 'live', minutes: 2 });
    for (const status of ['connecting', 'reconnecting'] as const) {
      expect(trayViewOf(snap({ status }), 0).state).toBe('live');
    }
    expect(trayViewOf(snap({ endedAt: 60_000 }), 9e6).minutes).toBe(1);
  });

  it('warns and names the stream that failed (AC3)', () => {
    expect(trayViewOf(snap({ micFailed: true }), 0)).toMatchObject({
      state: 'warning',
      problem: 'mic',
    });
    expect(trayViewOf(snap({ systemFailed: true }), 0)).toMatchObject({ problem: 'system' });
    expect(trayViewOf(snap({ micFailed: true, systemFailed: true }), 0).problem).toBeUndefined();
  });

  it('carries nothing from the meeting (AC7)', () => {
    const view = trayViewOf(snap({ completedSessionId: 'secret-id', meetingLanguage: 'ko' }), 0);
    expect(Object.keys(view).sort()).toEqual(['minutes', 'state']);
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
      setTray: vi.fn().mockResolvedValue(undefined),
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

  it('sends only changes and follows the meeting, also with the window hidden (AC6)', async () => {
    vi.useFakeTimers();
    const { controller, native, change } = setup();
    const stop = startTraySync(controller, native, () => Date.now());
    await vi.advanceTimersByTimeAsync(0);
    expect(native.setTray).toHaveBeenLastCalledWith({ state: 'idle', minutes: 0 });
    change(snap({ status: 'idle' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(native.setTray).toHaveBeenCalledTimes(1);
    change(snap({ startedAt: Date.now() }));
    await vi.advanceTimersByTimeAsync(0);
    expect(native.setTray).toHaveBeenLastCalledWith({ state: 'live', minutes: 0 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(native.setTray).toHaveBeenLastCalledWith({ state: 'live', minutes: 1 });
    stop();
    vi.useRealTimers();
  });

  it('stops the meeting when the menu item is chosen (AC5)', async () => {
    const { controller, native, fireStop } = setup();
    const stop = startTraySync(controller, native);
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireStop();
    expect(controller.stop).toHaveBeenCalledOnce();
    stop();
  });

  it('never throws when the icon cannot be updated', async () => {
    const { controller, native, change } = setup();
    native.setTray.mockRejectedValue(new Error('tray_missing'));
    const stop = startTraySync(controller, native);
    change(snap());
    await Promise.resolve();
    stop();
  });
});
