// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeetingControls } from './use-meeting-controls';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const h = vi.hoisted(() => ({
  userId: 'u1',
  picked: 'en',
  status: 'idle',
  mic: 'granted',
  setLanguage: vi.fn(),
  start: vi.fn(),
}));

vi.mock('../auth', () => ({ useMe: () => ({ me: { id: h.userId } }) }));
vi.mock('../lib/native', () => ({
  native: { permissionsStatus: async () => ({ microphone: h.mic, systemAudio: 'granted' }) },
}));
vi.mock('../settings', () => ({
  useLanguage: () => ({ language: h.picked, setLanguage: h.setLanguage }),
  useSettings: (select: (state: { assistLevel: string }) => unknown) =>
    select({ assistLevel: 'standard' }),
}));
vi.mock('./use-session', () => ({
  useSession: () => ({ start: h.start, stop: vi.fn() }),
  sessionController: { getSnapshot: () => ({ status: h.status }) },
}));

import { useMeetingControls } from './use-meeting-controls';

let host: HTMLElement;
let root: Root;
let controls: MeetingControls;

function Probe() {
  controls = useMeetingControls();
  return null;
}

let counter = 0;
beforeEach(() => {
  h.userId = `user-${++counter}`;
  h.picked = 'en';
  h.status = 'idle';
  h.mic = 'granted';
  h.setLanguage.mockReset();
  h.start.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Probe />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('useMeetingControls', () => {
  it('starts a device-language meeting at once', async () => {
    await act(() => controls.attempt());
    expect(h.start).toHaveBeenCalledWith('standard', 'en');
    expect(h.setLanguage).not.toHaveBeenCalled();
  });

  it('still starts when the microphone is blocked', async () => {
    h.mic = 'denied';
    await act(() => controls.attempt());
    expect(h.start).toHaveBeenCalledWith('standard', 'en');
  });

  it('asks for cloud consent before a cloud-language meeting, and starts only after agreeing', async () => {
    await act(() => controls.attempt('ja'));
    expect(h.start).not.toHaveBeenCalled();
    expect(controls.consent.open).toBe(true);
    act(() => controls.consent.confirm());
    expect(h.start).toHaveBeenCalledWith('standard', 'ja');
    expect(controls.consent.open).toBe(false);
  });

  it('asks for consent first even when the microphone is blocked', async () => {
    h.mic = 'denied';
    await act(() => controls.attempt('ja'));
    expect(h.start).not.toHaveBeenCalled();
    expect(controls.consent.open).toBe(true);
  });

  it('does not start, or switch the language, when the person cancels the consent', async () => {
    await act(() => controls.attempt('ja'));
    act(() => controls.consent.cancel());
    expect(h.start).not.toHaveBeenCalled();
    expect(h.setLanguage).not.toHaveBeenCalled();
    expect(controls.consent.open).toBe(false);
  });

  it('switches the picked language only once the meeting starts', async () => {
    await act(() => controls.attempt('ja'));
    expect(h.setLanguage).not.toHaveBeenCalled();
    act(() => controls.consent.confirm());
    expect(h.setLanguage).toHaveBeenCalledWith('ja');
  });

  it('neither starts nor switches the language while a meeting is live', async () => {
    h.status = 'running';
    await act(() => controls.attempt('ja'));
    act(() => controls.consent.confirm());
    expect(h.start).not.toHaveBeenCalled();
    expect(h.setLanguage).not.toHaveBeenCalled();
  });
});
