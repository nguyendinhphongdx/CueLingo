import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient } from './index';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('regenerateDebrief', () => {
  it('posts to the session debrief route and parses { queued: true }', async () => {
    const fetch = vi.fn().mockResolvedValue(json(202, { queued: true }));
    const client = createClient({ baseUrl: 'http://api', getToken: () => 't0k', fetch });

    expect(await client.regenerateDebrief('sess-1')).toEqual({ queued: true });
    expect(fetch.mock.calls[0]?.[0]).toBe('http://api/v1/sessions/sess-1/debrief');
    expect(fetch.mock.calls[0]?.[1].method).toBe('POST');
  });

  it('surfaces a conflict as ApiError', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(json(409, { error: { code: 'CONFLICT', message: 'running' } }));
    const client = createClient({ baseUrl: 'http://api', getToken: () => 't0k', fetch });

    const error = await client.regenerateDebrief('sess-1').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'CONFLICT' });
  });
});
