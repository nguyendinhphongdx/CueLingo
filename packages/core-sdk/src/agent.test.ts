import type { AgentStreamEvent } from '@cuelingo/shared';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient } from './index';

const ID = '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';
const enc = new TextEncoder();

const frame = (event: AgentStreamEvent | { type: string }) =>
  `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

const TURN: AgentStreamEvent[] = [
  { type: 'status', status: 'thinking' },
  { type: 'text_delta', text: 'Xin ' },
  { type: 'text_delta', text: 'chào' },
  { type: 'done', status: 'complete' },
];

function sse(chunks: Array<string | Uint8Array>, status = 200) {
  return new Response(
    new ReadableStream({
      start(c) {
        for (const chunk of chunks)
          c.enqueue(typeof chunk === 'string' ? enc.encode(chunk) : chunk);
        c.close();
      },
    }),
    { status, headers: { 'content-type': 'text/event-stream' } },
  );
}

const make = (fetch: ReturnType<typeof vi.fn>) =>
  createClient({
    baseUrl: 'http://api',
    getToken: () => 't0k',
    fetch: fetch as typeof globalThis.fetch,
    credentials: 'include',
  });

async function run(fetch: ReturnType<typeof vi.fn>, signal?: AbortSignal) {
  const events: AgentStreamEvent[] = [];
  await make(fetch).agent.sendMessage(
    ID,
    { content: 'hi' },
    { signal, onEvent: (e) => events.push(e) },
  );
  return events;
}

describe('agent.sendMessage', () => {
  it('posts the body with auth and credentials and delivers events in order', async () => {
    const fetch = vi.fn().mockResolvedValue(sse([TURN.map(frame).join('')]));
    const events = await run(fetch);

    expect(events).toEqual(TURN);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe(`http://api/v1/conversations/${ID}/messages`);
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer t0k');
    expect(init.headers.accept).toBe('text/event-stream');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual({ content: 'hi' });
  });

  it('survives chunks cut mid-line, mid-character and between CR and LF', async () => {
    const bytes = enc.encode(TURN.map((e) => frame(e).replace(/\n/g, '\r\n')).join(''));
    // One byte per chunk also splits multi-byte UTF-8 characters.
    const chunks = Array.from(bytes, (b) => new Uint8Array([b]));
    const fetch = vi.fn().mockResolvedValue(sse(chunks));
    expect(await run(fetch)).toEqual(TURN);

    const viet: AgentStreamEvent[] = [
      { type: 'text_delta', text: 'Tiếng Việt có dấu ổ' },
      { type: 'done', status: 'complete' },
    ];
    const vietBytes = enc.encode(viet.map(frame).join(''));
    const split = Array.from(vietBytes, (b) => new Uint8Array([b]));
    expect(await run(vi.fn().mockResolvedValue(sse(split)))).toEqual(viet);
  });

  it('ignores unknown events, malformed data and comments', async () => {
    const body =
      ': keep-alive\n\n' +
      frame({ type: 'future_thing' }) +
      'event: text_delta\ndata: {not json}\n\n' +
      'event: text_delta\ndata: {"type":"text_delta","text":5}\n\n' +
      frame(TURN[1]!) +
      frame(TURN[3]!);
    const events = await run(vi.fn().mockResolvedValue(sse([body])));
    expect(events).toEqual([TURN[1], TURN[3]]);
  });

  it.each([
    [409, 'CONFLICT', undefined],
    [503, 'AGENT_DISABLED', undefined],
    [429, 'AGENT_QUOTA_EXCEEDED', { turns: { used: 60, limit: 60 } }],
  ])('turns a pre-stream %i into ApiError %s', async (status, code, details) => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code, message: 'x', details } }), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const err = await run(fetch).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status, code, details });
  });

  it('throws NETWORK_ERROR when fetch fails or the stream ends before done', async () => {
    await expect(run(vi.fn().mockRejectedValue(new TypeError('offline')))).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
    const cut = vi.fn().mockResolvedValue(sse([frame(TURN[1]!)]));
    await expect(run(cut)).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('resolves quietly when aborted before sending or in the middle of the stream', async () => {
    const early = new AbortController();
    early.abort();
    const fetch = vi.fn();
    await expect(run(fetch, early.signal)).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();

    const ctrl = new AbortController();
    const live = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(enc.encode(frame(TURN[1]!)));
              init.signal?.addEventListener('abort', () =>
                c.error(new DOMException('x', 'AbortError')),
              );
            },
          }),
          { status: 200 },
        ),
    );
    const events: AgentStreamEvent[] = [];
    const pending = make(live).agent.sendMessage(
      ID,
      { content: 'hi' },
      {
        signal: ctrl.signal,
        onEvent: (e) => {
          events.push(e);
          ctrl.abort();
        },
      },
    );
    await expect(pending).resolves.toBeUndefined();
    expect(events).toEqual([TURN[1]]);
  });

  it('lets an error thrown by the handler through unchanged', async () => {
    const fetch = vi.fn().mockResolvedValue(sse([TURN.map(frame).join('')]));
    const boom = new Error('render failed');
    await expect(
      make(fetch).agent.sendMessage(
        ID,
        { content: 'hi' },
        {
          onEvent: () => {
            throw boom;
          },
        },
      ),
    ).rejects.toBe(boom);
  });

  it('validates the request before calling the server', async () => {
    const fetch = vi.fn();
    await expect(
      make(fetch).agent.sendMessage(ID, { content: '   ' }, { onEvent: () => {} }),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
