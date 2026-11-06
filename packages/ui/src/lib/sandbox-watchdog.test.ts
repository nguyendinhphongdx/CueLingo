import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWatchdog, type StallReason } from './sandbox-watchdog';

describe('sandbox watchdog', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function make() {
    const pings: number[] = [];
    const stalled: StallReason[] = [];
    const dog = createWatchdog({ ping: (n) => pings.push(n), onStalled: (r) => stalled.push(r) });
    return { dog, pings, stalled };
  }

  it('stops a frame that is not ready within 3 seconds (AC8)', () => {
    const t = make();
    t.dog.start();
    vi.advanceTimersByTime(2999);
    expect(t.stalled).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(t.stalled).toEqual(['no_ready']);
  });

  it('does not start counting before the frame loaded', () => {
    const t = make();
    vi.advanceTimersByTime(60_000);
    expect(t.stalled).toEqual([]);
    expect(t.pings).toEqual([]);
  });

  it('pings every 2 seconds once ready, and keeps going while pongs come back', () => {
    const t = make();
    t.dog.start();
    vi.advanceTimersByTime(1000);
    t.dog.ready();
    for (let i = 1; i <= 5; i += 1) {
      vi.advanceTimersByTime(2000);
      expect(t.pings).toHaveLength(i);
      t.dog.pong(i);
    }
    expect(t.pings).toEqual([1, 2, 3, 4, 5]);
    expect(t.stalled).toEqual([]);
  });

  it('stops a frame that stops answering, e.g. while(true) (AC8)', () => {
    const t = make();
    t.dog.start();
    t.dog.ready();
    vi.advanceTimersByTime(2000);
    t.dog.pong(1);
    vi.advanceTimersByTime(2000); // ping 2 goes out, never answered
    expect(t.stalled).toEqual([]);
    vi.advanceTimersByTime(2000);
    expect(t.stalled).toEqual(['no_pong']);
    // Nothing fires after it has fired once.
    vi.advanceTimersByTime(60_000);
    expect(t.stalled).toEqual(['no_pong']);
    expect(t.pings).toEqual([1, 2]);
  });

  it('ignores a pong for an older ping', () => {
    const t = make();
    t.dog.start();
    t.dog.ready();
    vi.advanceTimersByTime(2000);
    t.dog.pong(99);
    vi.advanceTimersByTime(2000);
    expect(t.stalled).toEqual(['no_pong']);
  });

  it('cancels every timer on stop', () => {
    const t = make();
    t.dog.start();
    t.dog.stop();
    vi.advanceTimersByTime(10_000);
    expect(t.stalled).toEqual([]);

    const u = make();
    u.dog.start();
    u.dog.ready();
    u.dog.stop();
    vi.advanceTimersByTime(10_000);
    expect(u.pings).toEqual([]);
    expect(u.stalled).toEqual([]);
  });

  it('ready twice or start twice does not double the timers', () => {
    const t = make();
    t.dog.start();
    t.dog.start();
    t.dog.ready();
    t.dog.ready();
    vi.advanceTimersByTime(2000);
    expect(t.pings).toEqual([1]);
  });
});
