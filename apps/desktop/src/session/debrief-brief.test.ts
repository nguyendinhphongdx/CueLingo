import type { Debrief } from '@cuelingo/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebriefApi, DebriefError, type DebriefApi } from './debrief-api';
import { pollDebrief, POLL_INTERVAL_MS, POLL_TIMEOUT_MS, summariseDebrief } from './debrief-brief';

const id = '6df65d24-949f-4456-b5d2-4394c9d7ae16';
const debrief: Debrief = {
  id,
  sessionId: id,
  version: 1,
  createdAt: '2026-11-03T01:00:00.000Z',
  summary: { headlineVi: 'Chốt kế hoạch', bulletsVi: ['a', 'b', 'c'] },
  actionItems: [
    { textVi: 'D1', kind: 'decision' },
    { textVi: 'D2', kind: 'decision' },
    { textVi: 'T1', kind: 'todo', owner: 'An' },
    { textVi: 'T2', kind: 'todo' },
    { textVi: 'T3', kind: 'todo' },
    { textVi: 'T4', kind: 'todo' },
    { textVi: 'T5', kind: 'todo' },
  ],
  hardSegmentIds: [],
  phraseSuggestions: [],
  rephrase: [],
  comprehensionPct: null,
};

describe('summariseDebrief', () => {
  it('keeps 3 summary lines and caps each list with a remainder', () => {
    const brief = summariseDebrief(debrief);
    expect(brief.summary).toEqual(['Chốt kế hoạch', 'a', 'b']);
    expect(brief.decisions).toEqual({ shown: ['D1', 'D2'], more: 0 });
    expect(brief.todos).toEqual({ shown: ['T1 (An)', 'T2', 'T3'], more: 2 });
  });

  it('copes with a debrief that has no learning blocks (vi)', () => {
    const brief = summariseDebrief({
      ...debrief,
      actionItems: [],
      summary: { headlineVi: ' ', bulletsVi: [] },
    });
    expect(brief.summary).toEqual([]);
    expect(brief.todos.shown).toEqual([]);
  });
});

describe('pollDebrief', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('polls every 3 s until the debrief exists', async () => {
    const get = vi
      .fn<DebriefApi['get']>()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(debrief);
    const onReady = vi.fn();
    pollDebrief({ get }, id, { onReady, onTimeout: vi.fn(), onDenied: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);
    expect(get).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(get).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(onReady).toHaveBeenCalledWith(debrief);
    await vi.advanceTimersByTimeAsync(POLL_TIMEOUT_MS);
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('times out after about two minutes', async () => {
    const get = vi.fn<DebriefApi['get']>().mockResolvedValue(null);
    const onTimeout = vi.fn();
    pollDebrief({ get }, id, { onReady: vi.fn(), onTimeout, onDenied: vi.fn() });
    await vi.advanceTimersByTimeAsync(POLL_TIMEOUT_MS - POLL_INTERVAL_MS - 1);
    expect(onTimeout).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 1);
    expect(onTimeout).toHaveBeenCalledOnce();
    const calls = get.mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_TIMEOUT_MS);
    expect(get.mock.calls.length).toBe(calls);
  });

  it('stops for good when cancelled, even with a request in flight', async () => {
    let resolve: (value: Debrief) => void = () => undefined;
    const get = vi.fn<DebriefApi['get']>(() => new Promise((r) => (resolve = r)));
    const onReady = vi.fn();
    const cancel = pollDebrief({ get }, id, { onReady, onTimeout: vi.fn(), onDenied: vi.fn() });
    cancel();
    resolve(debrief);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(onReady).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe('pollDebrief when not allowed', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each([401, 403])('stops at once on %i', async (status) => {
    const get = vi.fn<DebriefApi['get']>().mockRejectedValue(new DebriefError('no', status));
    const onDenied = vi.fn();
    pollDebrief({ get }, id, { onReady: vi.fn(), onTimeout: vi.fn(), onDenied });
    await vi.advanceTimersByTimeAsync(POLL_TIMEOUT_MS);
    expect(onDenied).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('keeps polling after a server error', async () => {
    const get = vi.fn<DebriefApi['get']>().mockRejectedValue(new DebriefError('boom', 500));
    const onDenied = vi.fn();
    pollDebrief({ get }, id, { onReady: vi.fn(), onTimeout: vi.fn(), onDenied });
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
    expect(onDenied).not.toHaveBeenCalled();
    expect(get.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('createDebriefApi', () => {
  it('returns null on 404 and parses a debrief', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json(debrief))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const api = createDebriefApi({ apiUrl: 'ws://api.test/', token: 't', fetch: request });
    await expect(api.get(id)).resolves.toBeNull();
    await expect(api.get(id)).resolves.toEqual(debrief);
    expect(request.mock.calls[0]![0]).toBe(`http://api.test/v1/sessions/${id}/debrief`);
    expect(new Headers(request.mock.calls[0]![1]?.headers).get('Authorization')).toBe('Bearer t');
    await expect(api.get(id)).rejects.toMatchObject({ status: 500 });
  });
});
