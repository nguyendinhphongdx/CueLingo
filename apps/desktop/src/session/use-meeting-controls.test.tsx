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
  /** What the model manager says about the picked language; null = this build cannot manage models. */
  modelView: null as { kind: string } | null,
  download: vi.fn(),
  restart: vi.fn(),
  cancel: vi.fn(),
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
vi.mock('../models/use-local-models', () => ({
  useLocalModels: () => ({
    view: () => h.modelView,
    download: h.download,
    restart: h.restart,
    cancel: h.cancel,
  }),
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
  h.modelView = null;
  h.download.mockReset();
  h.restart.mockReset();
  h.cancel.mockReset();
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

describe('the model dialog', () => {
  const rerender = () => act(() => root.render(<Probe />));

  it('opens instead of starting when the model is missing, and starts the download once', async () => {
    h.modelView = { kind: 'missing' };
    await act(() => controls.attempt());
    expect(h.start).not.toHaveBeenCalled();
    expect(controls.gate.open).toBe(true);
    expect(controls.gate.languageName).toBe('tiếng anh');
    expect(h.download).toHaveBeenCalledTimes(1);
    expect(h.download).toHaveBeenCalledWith('en');
    // More renders while it waits do not start more downloads.
    await rerender();
    await rerender();
    expect(h.download).toHaveBeenCalledTimes(1);
  });

  it('starts the meeting by itself, and closes, once the model is ready', async () => {
    h.modelView = { kind: 'missing' };
    await act(() => controls.attempt());
    h.modelView = { kind: 'downloading' };
    await rerender();
    expect(h.start).not.toHaveBeenCalled();
    h.modelView = { kind: 'ready' };
    await rerender();
    expect(h.start).toHaveBeenCalledWith('standard', 'en');
    expect(controls.gate.open).toBe(false);
  });

  it('waits without downloading again when a download is already running', async () => {
    h.modelView = { kind: 'downloading' };
    await act(() => controls.attempt());
    expect(controls.gate.open).toBe(true);
    expect(h.download).not.toHaveBeenCalled();
    h.modelView = { kind: 'ready' };
    await rerender();
    expect(h.start).toHaveBeenCalledTimes(1);
  });

  it('after a failure the person decides: nothing restarts by itself, retry does', async () => {
    h.modelView = { kind: 'error' };
    await act(() => controls.attempt());
    expect(controls.gate.open).toBe(true);
    expect(h.download).not.toHaveBeenCalled();
    act(() => controls.gate.download());
    expect(h.download).toHaveBeenCalledWith('en');
  });

  it('gives up on the meeting when the person closes it, and a later Start asks again', async () => {
    h.modelView = { kind: 'missing' };
    await act(() => controls.attempt());
    act(() => controls.gate.close());
    expect(controls.gate.open).toBe(false);
    h.modelView = { kind: 'ready' };
    await rerender();
    expect(h.start).not.toHaveBeenCalled();
    h.modelView = { kind: 'missing' };
    await act(() => controls.attempt());
    expect(controls.gate.open).toBe(true);
    expect(h.download).toHaveBeenCalledTimes(2);
  });

  it('hands ✕ and reload to the model manager for the language of the dialog', async () => {
    h.modelView = { kind: 'downloading' };
    await act(() => controls.attempt());
    act(() => controls.gate.cancelDownload());
    act(() => controls.gate.restart());
    expect(h.cancel).toHaveBeenCalledWith('en');
    expect(h.restart).toHaveBeenCalledWith('en');
  });

  it('never opens for a model that is ready, or for a build that cannot manage models', async () => {
    h.modelView = { kind: 'ready' };
    await act(() => controls.attempt());
    expect(h.start).toHaveBeenCalledTimes(1);
    expect(controls.gate.open).toBe(false);
  });

  it('does not open for a cloud language: consent comes first, then it starts', async () => {
    h.modelView = { kind: 'cloud' };
    await act(() => controls.attempt('ja'));
    expect(controls.gate.open).toBe(false);
    expect(controls.consent.open).toBe(true);
    await act(async () => controls.consent.confirm());
    expect(h.start).toHaveBeenCalledWith('standard', 'ja');
  });
});
