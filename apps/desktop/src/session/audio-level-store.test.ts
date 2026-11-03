import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LevelEvent } from '../lib/native';
import {
  createAudioLevelStore,
  LEVEL_HISTORY,
  LEVEL_TICK_MS,
  SILENCE_MS,
} from './audio-level-store';

function setup() {
  let emit: (event: LevelEvent) => void = () => undefined;
  const off = vi.fn();
  const listen = vi.fn(async (cb: (event: LevelEvent) => void) => {
    emit = cb;
    return off;
  });
  const store = createAudioLevelStore({ listen });
  const level = (stream: LevelEvent['stream'], rms: number) =>
    emit({ type: 'level', stream, rms, peak: rms });
  return { store, level, off, listen };
}

describe('audio level store', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not listen until started and cleans up on stop', async () => {
    const { store, off, listen } = setup();
    expect(listen).not.toHaveBeenCalled();
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(listen).toHaveBeenCalledOnce();
    store.stop();
    expect(off).toHaveBeenCalledOnce();
    expect(store.getSnapshot().mic).toEqual([]);
  });

  it('releases a listener that resolves after stop', async () => {
    const { store, off } = setup();
    store.start();
    store.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(off).toHaveBeenCalledOnce();
  });

  it('keeps the newest values in a rolling buffer', async () => {
    const { store, level } = setup();
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < LEVEL_HISTORY + 10; i += 1) {
      level('mic', 0.5);
      await vi.advanceTimersByTimeAsync(LEVEL_TICK_MS);
    }
    const { mic, system } = store.getSnapshot();
    expect(mic).toHaveLength(LEVEL_HISTORY);
    expect(mic.at(-1)).toBe(0.5);
    expect(system.every((v) => v === 0)).toBe(true);
  });

  it('decays smoothly after the signal stops', async () => {
    const { store, level } = setup();
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    level('mic', 0.8);
    await vi.advanceTimersByTimeAsync(LEVEL_TICK_MS);
    await vi.advanceTimersByTimeAsync(LEVEL_TICK_MS * 2);
    const [a, b, c] = store.getSnapshot().mic.slice(-3);
    expect(a).toBe(0.8);
    expect(b).toBeLessThan(a!);
    expect(c).toBeLessThan(b!);
    expect(c).toBeGreaterThan(0);
  });

  it('flags silence after 4 s without signal and clears it on sound', async () => {
    const { store, level } = setup();
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    level('system', 0.3);
    await vi.advanceTimersByTimeAsync(SILENCE_MS - 500);
    expect(store.getSnapshot().systemSilent).toBe(false);
    expect(store.getSnapshot().micSilent).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(store.getSnapshot().micSilent).toBe(true);
    expect(store.getSnapshot().systemSilent).toBe(true);
    level('mic', 0.2);
    await vi.advanceTimersByTimeAsync(LEVEL_TICK_MS);
    expect(store.getSnapshot().micSilent).toBe(false);
  });

  it('treats values under the threshold as silence', async () => {
    const { store, level } = setup();
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 100; i += 1) {
      level('mic', 0.005);
      await vi.advanceTimersByTimeAsync(LEVEL_TICK_MS);
    }
    expect(store.getSnapshot().micSilent).toBe(true);
  });

  it('stops notifying once a resting meter is full of zeros', async () => {
    const { store } = setup();
    const listener = vi.fn();
    store.subscribe(listener);
    store.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(LEVEL_TICK_MS * (LEVEL_HISTORY + 5));
    const calls = listener.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(listener.mock.calls.length).toBe(calls);
  });
});
