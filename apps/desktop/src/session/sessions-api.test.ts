import { describe, expect, it, vi } from 'vitest';
import { createSessionsApi } from './sessions-api';

const session = {
  id: '6df65d24-949f-4456-b5d2-4394c9d7ae16',
  title: null,
  startedAt: '2026-11-03T00:00:00.000Z',
  endedAt: null,
  status: 'live',
  assistLevel: 3,
} as const;

describe('sessions api', () => {
  it('creates and ends sessions with the configured URL and bearer token', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(session))
      .mockResolvedValueOnce(
        Response.json({
          ...session,
          endedAt: '2026-11-03T01:00:00.000Z',
          status: 'ended',
        }),
      );
    const api = createSessionsApi({
      apiUrl: 'ws://api.test/',
      token: 'secret-token',
      fetch: request,
    });

    await api.create({ assistLevel: 3 });
    await api.end(session.id);

    expect(request.mock.calls.map(([url]) => url)).toEqual([
      'http://api.test/v1/sessions',
      `http://api.test/v1/sessions/${session.id}/end`,
    ]);
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer secret-token' },
      body: JSON.stringify({ assistLevel: 3 }),
    });
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer secret-token' },
    });
  });

  it('parses responses with the shared session schema', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        ...session,
        unexpected: true,
      }),
    );
    const api = createSessionsApi({ apiUrl: 'https://api.test', token: 'token', fetch: request });

    await expect(api.create({ assistLevel: 3 })).rejects.toThrow();
  });

  it('rejects non-success responses', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    const api = createSessionsApi({ apiUrl: 'https://api.test', token: 'token', fetch: request });

    await expect(api.end(session.id)).rejects.toThrow('503');
  });
});
