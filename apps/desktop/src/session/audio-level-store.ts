import type { LevelEvent } from '../lib/native';

type Stream = LevelEvent['stream'];

export interface AudioLevelSnapshot {
  mic: number[];
  system: number[];
  /** True once the stream has been quiet for SILENCE_MS while metering. */
  micSilent: boolean;
  systemSilent: boolean;
}

/** Recent values kept per stream (about 2.4 s at the render rate). */
export const LEVEL_HISTORY = 48;
/** Render rate: 20 fps at most. */
export const LEVEL_TICK_MS = 50;
/** Below this RMS a stream counts as quiet. */
export const SIGNAL_THRESHOLD = 0.01;
export const SILENCE_MS = 4_000;
/** Each tick the shown value falls to this share of the last one when nothing louder came in. */
const DECAY = 0.8;
const EPSILON = 0.001;

interface Options {
  listen(callback: (event: LevelEvent) => void): Promise<() => void>;
  now?: () => number;
}

const empty = (): AudioLevelSnapshot => ({
  mic: [],
  system: [],
  micSilent: false,
  systemSilent: false,
});

/** Rolling buffers of recent audio levels; listens to the native side only between start() and stop(). */
export function createAudioLevelStore({ listen, now = Date.now }: Options) {
  let snapshot = empty();
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let unlisten: (() => void) | null = null;
  let generation = 0;
  const pending: Record<Stream, number> = { mic: 0, system: 0 };
  const last: Record<Stream, number> = { mic: 0, system: 0 };
  const lastSignalAt: Record<Stream, number> = { mic: 0, system: 0 };

  function push(buffer: number[], value: number): number[] {
    const next = buffer.length >= LEVEL_HISTORY ? buffer.slice(1) : buffer.slice();
    next.push(value);
    return next;
  }

  function tick() {
    const time = now();
    const next = { ...snapshot };
    let changed = false;
    for (const stream of ['mic', 'system'] as const) {
      const value = Math.max(pending[stream], last[stream] * DECAY);
      pending[stream] = 0;
      const shown = value < EPSILON ? 0 : value;
      last[stream] = shown;
      const buffer = snapshot[stream];
      // A resting meter is not redrawn: nothing in the buffer and nothing new.
      if (!(shown === 0 && buffer.every((v) => v === 0) && buffer.length >= LEVEL_HISTORY)) {
        next[stream] = push(buffer, shown);
        changed = true;
      }
      const silent = time - lastSignalAt[stream] >= SILENCE_MS;
      const key = stream === 'mic' ? 'micSilent' : 'systemSilent';
      if (silent !== snapshot[key]) {
        next[key] = silent;
        changed = true;
      }
    }
    if (changed) {
      snapshot = next;
      listeners.forEach((listener) => listener());
    }
  }

  function handle(event: LevelEvent) {
    pending[event.stream] = Math.max(pending[event.stream], event.rms);
    if (event.rms >= SIGNAL_THRESHOLD) lastSignalAt[event.stream] = now();
  }

  function stop() {
    generation += 1;
    if (timer) clearInterval(timer);
    timer = null;
    unlisten?.();
    unlisten = null;
    pending.mic = pending.system = last.mic = last.system = 0;
    snapshot = empty();
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Starts listening; calling it again while started does nothing. */
    start() {
      if (timer) return;
      const mine = ++generation;
      lastSignalAt.mic = lastSignalAt.system = now();
      timer = setInterval(tick, LEVEL_TICK_MS);
      void listen(handle)
        .then((off) => {
          if (mine !== generation) off();
          else unlisten = off;
        })
        .catch(() => undefined);
    },
    stop,
  };
}

export type AudioLevelStore = ReturnType<typeof createAudioLevelStore>;
