import { MAX_BRIDGE_MESSAGE_BYTES, type BridgeResponse } from '@cuelingo/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  createBridgeHost,
  type BridgeHandlers,
  type BridgeHostOptions,
  type RejectReason,
} from './bridge-host';

const FRAME = { name: 'runner-frame' };
const OTHER = { name: 'some-other-window' };

const req = (op: string, args?: unknown, id = 'r1') => ({
  v: 1,
  id,
  op,
  ...(args === undefined ? {} : { args }),
});

function setup(over: Partial<BridgeHandlers> = {}, options: Partial<BridgeHostOptions> = {}) {
  const replies: BridgeResponse[] = [];
  const rejected: Array<{ reason: RejectReason; op: string }> = [];
  const calls: string[] = [];
  let clock = 1_000_000;
  const handlers: BridgeHandlers = {
    resize: vi.fn((h: number) => void calls.push(`resize:${h}`)),
    ready: vi.fn(() => void calls.push('ready')),
    error: vi.fn(() => void calls.push('error')),
    pong: vi.fn((n: number) => void calls.push(`pong:${n}`)),
    listPhrases: vi.fn(async () => [
      { phrase: 'circle back', meaningVi: 'quay lại sau' },
      { phrase: 'touch base', meaningVi: null },
    ]),
    confirmSave: vi.fn(async () => true),
    savePhrase: vi.fn(async () => void calls.push('save')),
    speak: vi.fn(() => void calls.push('speak')),
    // An override is a spy too, so tests can count its calls.
    ...(Object.fromEntries(
      Object.entries(over).map(([name, fn]) => [name, vi.fn(fn as never)]),
    ) as Partial<BridgeHandlers>),
  };
  const host = createBridgeHost({
    getFrameWindow: () => FRAME,
    reply: (r) => replies.push(r),
    onRejected: (info) => rejected.push(info),
    handlers,
    now: () => clock,
    ...options,
  });
  const send = (data: unknown, over: { source?: unknown; origin?: string } = {}) =>
    host.handleMessage({
      origin: over.origin ?? 'null',
      source: 'source' in over ? over.source : FRAME,
      data,
    });
  return {
    host,
    handlers,
    replies,
    rejected,
    calls,
    send,
    tick: (ms: number) => void (clock += ms),
  };
}

describe('bridge host: who may talk', () => {
  it('accepts the runner frame with the opaque origin a sandboxed frame reports', async () => {
    const t = setup();
    await t.send(req('ui.ready'));
    expect(t.calls).toEqual(['ready']);
    expect(t.replies).toEqual([{ v: 1, id: 'r1', ok: true }]);
  });

  it('drops a message whose source is not the runner frame, whatever it says', async () => {
    const t = setup();
    await t.send(req('tts.speak', { text: 'hi' }), { source: OTHER });
    await t.send(req('tts.speak', { text: 'hi' }), { source: null });
    await t.send(req('tts.speak', { text: 'hi' }), { source: window_like() });
    expect(t.handlers.speak).not.toHaveBeenCalled();
    expect(t.replies).toEqual([]);
    expect(t.rejected.map((r) => r.reason)).toEqual([
      'wrong_source',
      'wrong_source',
      'wrong_source',
    ]);
  });

  it('drops everything while no frame exists', async () => {
    const t = setup({}, { getFrameWindow: () => null });
    await t.send(req('ui.ready'), { source: null });
    expect(t.handlers.ready).not.toHaveBeenCalled();
    expect(t.rejected[0]?.reason).toBe('wrong_source');
  });

  it('drops a message from the right window with the wrong origin', async () => {
    const t = setup();
    await t.send(req('ui.ready'), { origin: 'https://evil.example' });
    await t.send(req('ui.ready'), { origin: 'http://localhost:3101' });
    await t.send(req('ui.ready'), { origin: '' });
    expect(t.handlers.ready).not.toHaveBeenCalled();
    expect(t.replies).toEqual([]);
    expect(t.rejected.map((r) => r.reason)).toEqual([
      'wrong_origin',
      'wrong_origin',
      'wrong_origin',
    ]);
  });

  it('honours an explicit list of accepted origins', async () => {
    const t = setup({}, { acceptedOrigins: ['null', 'http://localhost:3101'] });
    await t.send(req('ui.ready'), { origin: 'http://localhost:3101' });
    expect(t.handlers.ready).toHaveBeenCalledOnce();
  });

  it('ignores everything after dispose', async () => {
    const t = setup();
    t.host.dispose();
    await t.send(req('ui.ready'));
    expect(t.handlers.ready).not.toHaveBeenCalled();
    expect(t.rejected[0]?.reason).toBe('disposed');
  });
});

/** A stand-in for a real `Window`: not the frame, with a postMessage that must never be used. */
function window_like() {
  return { postMessage: () => undefined, name: 'runner-frame' };
}

describe('bridge host: what may be asked', () => {
  it('refuses operations outside the allowlist and says so, without running anything', async () => {
    const t = setup();
    for (const op of [
      'fetch',
      'fs.read',
      'phrases.delete',
      'eval',
      '__proto__',
      'constructor',
      'ui.reload',
    ])
      await t.send(req(op, { url: 'https://x.test' }, `id-${op}`));
    expect(
      Object.values(t.handlers).every(
        (fn) => (fn as ReturnType<typeof vi.fn>).mock.calls.length === 0,
      ),
    ).toBe(true);
    expect(t.replies.every((r) => !r.ok && r.error === 'op_not_allowed')).toBe(true);
    expect(t.replies).toHaveLength(7);
    // The log names no operation that is not on the list, so a page cannot write text into it.
    expect(t.rejected.every((r) => r.op === 'unknown')).toBe(true);
  });

  it('refuses non-object messages and bad shapes without throwing', async () => {
    const t = setup();
    for (const data of [null, undefined, 'ui.ready', 42, [], { op: 'ui.ready' }, { v: 1, op: 5 }])
      await t.send(data);
    expect(t.calls).toEqual([]);
    expect(t.replies).toEqual([]);
  });

  it('refuses invalid arguments and extra fields, answering "invalid"', async () => {
    const t = setup();
    await t.send(req('ui.resize', { height: 99_999 }, 'a'));
    await t.send(req('ui.resize', { height: 'tall' }, 'b'));
    await t.send(req('phrases.save', { phrase: '' }, 'c'));
    await t.send(req('phrases.save', { phrase: 'x', userId: 'someone-else' }, 'd'));
    await t.send({ ...req('tts.speak', { text: 'hi' }, 'e'), v: 2 });
    await t.send({ ...req('ui.ready', undefined, 'f'), extra: 1 });
    expect(t.replies.map((r) => (r.ok ? 'ok' : r.error))).toEqual(Array(6).fill('invalid'));
    expect(t.handlers.confirmSave).not.toHaveBeenCalled();
    expect(t.handlers.resize).not.toHaveBeenCalled();
  });

  it('does not answer a message whose id cannot be trusted', async () => {
    const t = setup();
    await t.send({ v: 1, id: { evil: true }, op: 'nope' });
    await t.send({ v: 1, id: 'x'.repeat(65), op: 'nope' });
    await t.send({ v: 1, op: 'nope' });
    expect(t.replies).toEqual([]);
    expect(t.rejected).toHaveLength(3);
  });

  it('runs the allowed operations and answers with the same id', async () => {
    const t = setup();
    await t.send(req('ui.resize', { height: 320 }, 'a'));
    await t.send(req('ui.error', { message: 'boom' }, 'b'));
    await t.send(req('tts.speak', { text: 'Hello there' }, 'c'));
    expect(t.calls).toEqual(['resize:320', 'error', 'speak']);
    expect(t.replies.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(t.replies.every((r) => r.ok)).toBe(true);
  });

  it('passes pongs to the watchdog, and nothing else about them', async () => {
    const t = setup();
    await t.send({ v: 1, kind: 'pong', n: 4 });
    await t.send({ v: 1, kind: 'pong', n: -1 });
    await t.send({ v: 1, kind: 'pong', n: 1, extra: true });
    expect(t.calls).toEqual(['pong:4']);
    expect(t.replies).toEqual([]);
  });
});

describe('bridge host: phrases', () => {
  it('lists only phrase and meaning, at most 50, trimmed to schema limits', async () => {
    const many = Array.from({ length: 80 }, (_, i) => ({
      phrase: `p${i}`.padEnd(300, 'x'),
      meaningVi: 'm'.repeat(900),
      // Fields the page must never see, as a careless handler might return them.
      id: 'secret-id',
      inReview: true,
    }));
    const t = setup({ listPhrases: async () => many as never });
    await t.send(req('phrases.list'));
    const reply = t.replies[0]!;
    expect(reply.ok).toBe(true);
    if (!reply.ok) return;
    expect(reply.data?.phrases).toHaveLength(50);
    expect(reply.data?.phrases[0]).toEqual({
      phrase: 'p0'.padEnd(200, 'x'),
      meaningVi: 'm'.repeat(500),
    });
    expect(JSON.stringify(reply)).not.toContain('secret-id');
  });

  it('saves only after the person confirmed (AC9)', async () => {
    const order: string[] = [];
    let agree!: (value: boolean) => void;
    const t = setup({
      confirmSave: () =>
        new Promise<boolean>((resolve) => {
          order.push('asked');
          agree = resolve;
        }),
      savePhrase: async () => void order.push('saved'),
    });
    const pending = t.send(req('phrases.save', { phrase: 'circle back', meaningVi: 'quay lại' }));
    await Promise.resolve();
    expect(order).toEqual(['asked']);
    expect(t.replies).toEqual([]);
    agree(true);
    await pending;
    expect(order).toEqual(['asked', 'saved']);
    expect(t.handlers.savePhrase).toHaveBeenCalledWith({
      phrase: 'circle back',
      meaningVi: 'quay lại',
    });
    expect(t.replies).toEqual([{ v: 1, id: 'r1', ok: true }]);
  });

  it('does not save when the person declines, and tells the page', async () => {
    const t = setup({ confirmSave: async () => false });
    await t.send(req('phrases.save', { phrase: 'circle back' }));
    expect(t.handlers.savePhrase).not.toHaveBeenCalled();
    expect(t.replies).toEqual([{ v: 1, id: 'r1', ok: false, error: 'declined' }]);
  });

  it('asks one question at a time', async () => {
    let agree!: (value: boolean) => void;
    const t = setup({ confirmSave: () => new Promise<boolean>((resolve) => (agree = resolve)) });
    const first = t.send(req('phrases.save', { phrase: 'one' }, 'a'));
    await Promise.resolve();
    await t.send(req('phrases.save', { phrase: 'two' }, 'b'));
    expect(t.handlers.confirmSave).toHaveBeenCalledOnce();
    expect(t.replies).toEqual([{ v: 1, id: 'b', ok: false, error: 'busy' }]);
    agree(false);
    await first;
    // The slot is free again once the first question is answered.
    const third = t.send(req('phrases.save', { phrase: 'three' }, 'c'));
    await Promise.resolve();
    expect(t.handlers.confirmSave).toHaveBeenCalledTimes(2);
    agree(false);
    await third;
  });

  it('does not save if the block was removed while the dialog was open', async () => {
    let agree!: (value: boolean) => void;
    const t = setup({ confirmSave: () => new Promise<boolean>((resolve) => (agree = resolve)) });
    const pending = t.send(req('phrases.save', { phrase: 'circle back' }));
    await Promise.resolve();
    t.host.dispose();
    agree(true);
    await pending;
    expect(t.handlers.savePhrase).not.toHaveBeenCalled();
    expect(t.replies).toEqual([]);
  });

  it('turns a failing handler into "failed", never into its message', async () => {
    const t = setup({
      listPhrases: async () => {
        throw new Error('SELECT secret FROM users');
      },
      savePhrase: async () => {
        throw new Error('db down');
      },
    });
    await t.send(req('phrases.list', undefined, 'a'));
    await t.send(req('phrases.save', { phrase: 'x' }, 'b'));
    expect(t.replies).toEqual([
      { v: 1, id: 'a', ok: false, error: 'failed' },
      { v: 1, id: 'b', ok: false, error: 'failed' },
    ]);
    expect(JSON.stringify(t.replies)).not.toContain('secret');
  });
});

describe('bridge host: size and rate', () => {
  it('drops an oversized message unread, answering "too_large" when it has an id', async () => {
    const t = setup();
    const big = req('tts.speak', { text: 'a'.repeat(MAX_BRIDGE_MESSAGE_BYTES) });
    await t.send(big);
    await t.send({ junk: 'x'.repeat(MAX_BRIDGE_MESSAGE_BYTES + 1) });
    expect(t.handlers.speak).not.toHaveBeenCalled();
    expect(t.replies).toEqual([{ v: 1, id: 'r1', ok: false, error: 'too_large' }]);
    expect(t.rejected.map((r) => r.reason)).toEqual(['too_large', 'too_large']);
  });

  it('counts bytes, not characters', async () => {
    const t = setup();
    // 6000 characters of 3 bytes each is 18 KB.
    await t.send(req('tts.speak', { text: 'ạ'.repeat(6000) }));
    expect(t.rejected[0]?.reason).toBe('too_large');
  });

  it('drops messages that cannot be serialised', async () => {
    const t = setup();
    const cycle: Record<string, unknown> = { v: 1, id: 'a', op: 'ui.ready' };
    cycle.self = cycle;
    await t.send(cycle);
    await t.send({ v: 1, id: 'b', op: 'ui.ready', args: { n: 10n } });
    expect(t.handlers.ready).not.toHaveBeenCalled();
    expect(t.rejected.map((r) => r.reason)).toEqual(['unserializable', 'unserializable']);
  });

  it('allows 20 data operations a minute per block and refuses the 21st', async () => {
    const t = setup();
    for (let i = 0; i < 20; i += 1) await t.send(req('tts.speak', { text: 'hi' }, `s${i}`));
    expect(t.handlers.speak).toHaveBeenCalledTimes(20);
    await t.send(req('phrases.list', undefined, 'late'));
    await t.send(req('tts.speak', { text: 'hi' }, 'late2'));
    expect(t.handlers.listPhrases).not.toHaveBeenCalled();
    expect(t.handlers.speak).toHaveBeenCalledTimes(20);
    expect(t.replies.slice(-2)).toEqual([
      { v: 1, id: 'late', ok: false, error: 'rate_limited' },
      { v: 1, id: 'late2', ok: false, error: 'rate_limited' },
    ]);
    // A minute later the window has moved on.
    t.tick(60_001);
    await t.send(req('tts.speak', { text: 'hi' }, 'again'));
    expect(t.handlers.speak).toHaveBeenCalledTimes(21);
  });

  it('does not let UI chatter use up the data allowance, and caps the chatter too', async () => {
    const t = setup();
    for (let i = 0; i < 120; i += 1)
      await t.send(req('ui.resize', { height: 100 + (i % 50) }, `u${i}`));
    expect(t.handlers.resize).toHaveBeenCalledTimes(120);
    await t.send(req('ui.resize', { height: 200 }, 'over'));
    expect(t.replies.at(-1)).toEqual({ v: 1, id: 'over', ok: false, error: 'rate_limited' });
    await t.send(req('tts.speak', { text: 'hi' }, 'data'));
    expect(t.handlers.speak).toHaveBeenCalledOnce();
  });

  it('stops looking at a flood of garbage at all', async () => {
    const t = setup();
    for (let i = 0; i < 400; i += 1) await t.send({ junk: i });
    const reasons = t.rejected.map((r) => r.reason);
    expect(reasons.filter((r) => r === 'flood').length).toBe(100);
  });

  it('counts a refused save attempt that was never confirmed toward the allowance', async () => {
    const t = setup({ confirmSave: async () => false });
    for (let i = 0; i < 20; i += 1) await t.send(req('phrases.save', { phrase: `p${i}` }, `a${i}`));
    await t.send(req('phrases.save', { phrase: 'p21' }, 'x'));
    expect(t.handlers.confirmSave).toHaveBeenCalledTimes(20);
    expect(t.replies.at(-1)).toEqual({ v: 1, id: 'x', ok: false, error: 'rate_limited' });
  });
});
