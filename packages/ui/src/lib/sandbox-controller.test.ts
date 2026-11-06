import type { BridgeHostMessage } from '@cuelingo/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSandboxController } from './sandbox-controller';
import { initialSandboxState, sandboxReducer, type SandboxEvent } from './sandbox-state';

const FRAME = { name: 'runner' };
const req = (op: string, args?: unknown, id = 'r1') => ({
  v: 1,
  id,
  op,
  ...(args ? { args } : {}),
});

describe('sandbox controller (AC7, AC8, AC9 wiring)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function make(over: { askToSave?: (i: { phrase: string }) => Promise<boolean> } = {}) {
    const posted: BridgeHostMessage[] = [];
    const events: SandboxEvent[] = [];
    let stoppedCalls = 0;
    const savePhrase = vi.fn(async () => {});
    const c = createSandboxController({
      html: '<p>hi</p>',
      getFrameWindow: () => FRAME,
      post: (m) => posted.push(m),
      dispatch: (e) => events.push(e),
      askToSave: over.askToSave ?? (async () => true),
      listPhrases: async () => [{ phrase: 'a', meaningVi: null }],
      savePhrase,
      speak: () => {},
      onStopped: () => void (stoppedCalls += 1),
    });
    const fromFrame = (data: unknown) => c.handleMessage({ origin: 'null', source: FRAME, data });
    const state = () => events.reduce(sandboxReducer, initialSandboxState());
    return { c, posted, events, savePhrase, fromFrame, state, stopped: () => stoppedCalls };
  }

  it('sends the page once the runner has loaded, and only once', () => {
    const t = make();
    expect(t.posted).toEqual([]);
    t.c.onFrameLoad();
    t.c.onFrameLoad();
    expect(t.posted).toEqual([{ v: 1, kind: 'render', html: '<p>hi</p>' }]);
  });

  it('runs after ui.ready, follows resize, and keeps pinging while the page answers', async () => {
    const t = make();
    t.c.onFrameLoad();
    await t.fromFrame(req('ui.resize', { height: 280 }, 'a'));
    await t.fromFrame(req('ui.ready', undefined, 'b'));
    expect(t.state()).toMatchObject({ phase: 'running', height: 280 });
    vi.advanceTimersByTime(2000);
    expect(t.posted.at(-1)).toEqual({ v: 1, kind: 'ping', n: 1 });
    await t.fromFrame({ v: 1, kind: 'pong', n: 1 });
    vi.advanceTimersByTime(2000);
    expect(t.posted.at(-1)).toEqual({ v: 1, kind: 'ping', n: 2 });
    expect(t.state().phase).toBe('running');
  });

  it('stops a page that never says ready (while(true) at the top level)', () => {
    const t = make();
    t.c.onFrameLoad();
    vi.advanceTimersByTime(3000);
    expect(t.state()).toMatchObject({ phase: 'stopped', reason: 'no_ready' });
    expect(t.stopped()).toBeGreaterThan(0);
  });

  it('stops a page that stops answering pings, and ignores what it sends afterwards', async () => {
    const t = make();
    t.c.onFrameLoad();
    await t.fromFrame(req('ui.ready'));
    vi.advanceTimersByTime(2000);
    vi.advanceTimersByTime(2000);
    expect(t.state()).toMatchObject({ phase: 'stopped', reason: 'no_pong' });
    const before = t.posted.length;
    await t.fromFrame(req('tts.speak', { text: 'late' }, 'z'));
    expect(t.posted).toHaveLength(before);
  });

  it('stops the block on ui.error, which is also how a CSP violation is reported', async () => {
    const t = make();
    t.c.onFrameLoad();
    await t.fromFrame(req('ui.ready'));
    await t.fromFrame(req('ui.error', { message: 'blocked: connect-src' }, 'e'));
    expect(t.state()).toMatchObject({ phase: 'stopped', reason: 'error' });
    const pings = t.posted.filter((m) => m.kind === 'ping').length;
    vi.advanceTimersByTime(60_000);
    expect(t.posted.filter((m) => m.kind === 'ping')).toHaveLength(pings);
  });

  it('answers a save only after the person agreed, and tells the page when they decline', async () => {
    const yes = make({ askToSave: async () => true });
    yes.c.onFrameLoad();
    await yes.fromFrame(req('phrases.save', { phrase: 'circle back' }, 's1'));
    expect(yes.savePhrase).toHaveBeenCalledOnce();
    expect(yes.posted.at(-1)).toEqual({
      v: 1,
      kind: 'reply',
      response: { v: 1, id: 's1', ok: true },
    });

    const no = make({ askToSave: async () => false });
    no.c.onFrameLoad();
    await no.fromFrame(req('phrases.save', { phrase: 'circle back' }, 's2'));
    expect(no.savePhrase).not.toHaveBeenCalled();
    expect(no.posted.at(-1)).toEqual({
      v: 1,
      kind: 'reply',
      response: { v: 1, id: 's2', ok: false, error: 'declined' },
    });
  });

  it('closes a pending dialog when the block is stopped, and then does not save', async () => {
    let answer!: (agreed: boolean) => void;
    const t = make({ askToSave: () => new Promise<boolean>((resolve) => (answer = resolve)) });
    t.c.onFrameLoad();
    const saving = t.fromFrame(req('phrases.save', { phrase: 'circle back' }, 's'));
    await Promise.resolve();
    await t.fromFrame(req('ui.error', { message: 'x' }, 'e'));
    expect(t.stopped()).toBeGreaterThan(0);
    answer(true); // the person clicks late, or the component cancels with false
    await saving;
    expect(t.savePhrase).not.toHaveBeenCalled();
  });

  it('ignores messages from any other window or origin', async () => {
    const t = make();
    t.c.onFrameLoad();
    await t.c.handleMessage({
      origin: 'null',
      source: { name: 'attacker' },
      data: req('ui.ready'),
    });
    await t.c.handleMessage({ origin: 'https://evil.test', source: FRAME, data: req('ui.ready') });
    expect(t.state().phase).toBe('loading');
    expect(t.posted.filter((m) => m.kind === 'reply')).toEqual([]);
  });

  it('dispose stops the watchdog and drops later messages', async () => {
    const t = make();
    t.c.onFrameLoad();
    t.c.dispose();
    vi.advanceTimersByTime(60_000);
    await t.fromFrame(req('ui.ready'));
    expect(t.state().phase).toBe('loading');
    expect(t.posted).toHaveLength(1);
  });
});
