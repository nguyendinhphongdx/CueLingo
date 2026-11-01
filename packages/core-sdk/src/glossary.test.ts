import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient } from './index';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('glossary client', () => {
  it('sends the token and parses the list', async () => {
    const fetch = vi.fn().mockResolvedValue(
      json(200, {
        items: [
          {
            id: '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f',
            term: 'Acme',
            translation: null,
            note: null,
            createdAt: '2026-10-31T00:00:00.000Z',
          },
        ],
      }),
    );
    const client = createClient({ baseUrl: 'http://api', getToken: () => 't0k', fetch });

    const items = await client.glossary.list();

    expect(items[0]?.term).toBe('Acme');
    expect(fetch.mock.calls[0]?.[1].headers.authorization).toBe('Bearer t0k');
  });

  it('forwards the credentials option so the browser sends the session cookie', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { items: [] }));
    const client = createClient({
      baseUrl: 'http://api',
      getToken: () => null,
      fetch,
      credentials: 'include',
    });

    await client.glossary.list();

    expect(fetch.mock.calls[0]?.[1].credentials).toBe('include');
  });

  it('maps an error response to ApiError with the shared code', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(json(409, { error: { code: 'CONFLICT', message: 'exists' } }));
    const client = createClient({ baseUrl: 'http://api', getToken: () => null, fetch });

    await expect(client.glossary.create({ term: 'Acme' })).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
    });
    await expect(client.glossary.create({ term: 'Acme' })).rejects.toBeInstanceOf(ApiError);
  });
});
