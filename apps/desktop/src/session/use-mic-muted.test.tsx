// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { AudioStatusEvent, MicStateEvent } from '../lib/native';
import { useMicMuted } from './use-mic-muted';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function fakeSource(initiallyMuted = false) {
  let listener: ((event: MicStateEvent) => void) | undefined;
  let statusListener: ((event: AudioStatusEvent) => void) | undefined;
  const unlisten = vi.fn();
  return {
    source: {
      onMicState: vi.fn(async (cb: (event: MicStateEvent) => void) => {
        listener = cb;
        return unlisten;
      }),
      onAudioStatus: vi.fn(async (cb: (event: AudioStatusEvent) => void) => {
        statusListener = cb;
        return unlisten;
      }),
      setMicMuted: vi.fn(async () => undefined),
      micMuted: vi.fn(async () => initiallyMuted),
    },
    status: (message: string) => statusListener?.({ type: 'status', state: 'error', message }),
    emit: (muted: boolean) => listener?.({ type: 'mic', muted }),
    unlisten,
  };
}

function mount(source: ReturnType<typeof fakeSource>['source']) {
  const seen: { current: ReturnType<typeof useMicMuted> | null } = { current: null };
  function Probe() {
    seen.current = useMicMuted(true, source);
    return null;
  }
  const root = createRoot(document.createElement('div'));
  return { root, seen, render: () => act(async () => root.render(<Probe />)) };
}

describe('useMicMuted', () => {
  it('starts on and follows the sidecar, not the click', async () => {
    const fake = fakeSource();
    const { seen, render } = mount(fake.source);
    await render();
    expect(seen.current?.muted).toBe(false);

    await act(async () => seen.current?.setMuted(true));
    expect(fake.source.setMicMuted).toHaveBeenCalledWith(true);
    // Nothing changes until the sidecar confirms.
    expect(seen.current?.muted).toBe(false);

    await act(async () => fake.emit(true));
    expect(seen.current?.muted).toBe(true);
    await act(async () => fake.emit(false));
    expect(seen.current?.muted).toBe(false);
  });

  it('knows when the microphone could not be opened, until a new meeting starts', async () => {
    const fake = fakeSource();
    const { seen, render } = mount(fake.source);
    await render();
    await act(async () => fake.status('system audio: denied'));
    expect(seen.current?.failed).toBe(false);
    await act(async () => fake.status('microphone: denied'));
    expect(seen.current?.failed).toBe(true);
    await act(async () => fake.emit(false));
    expect(seen.current?.failed).toBe(false);
  });

  it('starts from the real state when the window opens in the middle of a meeting', async () => {
    const fake = fakeSource(true);
    const { seen, render } = mount(fake.source);
    await render();
    expect(seen.current?.muted).toBe(true);
  });

  it('stops listening on unmount', async () => {
    const fake = fakeSource();
    const { root, render } = mount(fake.source);
    await render();
    await act(async () => root.unmount());
    expect(fake.unlisten).toHaveBeenCalledTimes(2);
  });
});
