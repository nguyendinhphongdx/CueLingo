import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkServer } from './check-server';

const SECRET = 'https://secret-host.example';
const reply = (status: number, body: unknown) => async () =>
  new Response(JSON.stringify(body), { status });

afterEach(() => vi.restoreAllMocks());

describe('checkServer (AC6)', () => {
  it('calls /healthz of the chosen server and reports success', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('{"ok":true}'));
    expect(await checkServer(`${SECRET}/`, { fetcher })).toEqual({ ok: true });
    expect(fetcher.mock.calls[0]![0]).toBe(`${SECRET}/healthz`);
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ credentials: 'omit' });
  });

  it('says why it failed, in a short sentence', async () => {
    const down = await checkServer(SECRET, {
      fetcher: async () => {
        throw new TypeError('fetch failed');
      },
    });
    expect(down).toEqual({ ok: false, cause: expect.stringContaining('Không kết nối được') });

    const error = await checkServer(SECRET, { fetcher: reply(503, {}) });
    expect(error).toEqual({ ok: false, cause: expect.stringContaining('503') });

    const other = await checkServer(SECRET, { fetcher: reply(200, { hello: 1 }) });
    expect(other).toEqual({
      ok: false,
      cause: expect.stringContaining('không phải máy chủ CueLingo'),
    });
  });

  it('gives up after the timeout', async () => {
    const hang = (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError')));
      });
    const result = await checkServer(SECRET, { fetcher: hang as typeof fetch, timeoutMs: 20 });
    expect(result).toEqual({ ok: false, cause: expect.stringContaining('quá thời gian chờ') });
  });
});

describe('checkServer keeps the address private (AC13)', () => {
  it('puts the address in no cause and writes nothing to the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    );
    const results = [
      await checkServer(SECRET, { fetcher: reply(500, {}) }),
      await checkServer(SECRET, {
        fetcher: async () => {
          throw new Error(`connect ECONNREFUSED ${SECRET}`);
        },
      }),
      await checkServer(SECRET, { fetcher: reply(200, { ok: true }) }),
    ];
    expect(JSON.stringify(results)).not.toContain('secret-host');
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
