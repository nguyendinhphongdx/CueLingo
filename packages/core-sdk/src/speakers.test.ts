import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient } from './index';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const SESSION = '9ee72a14-8cd4-4f2e-8131-4ed638e2d875';
const SPEAKER = '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';

describe('speakers client', () => {
  it('PATCHes the name and returns the speaker', async () => {
    const speaker = { id: SPEAKER, label: 'speaker_1', displayName: 'Lan' };
    const fetch = vi.fn().mockResolvedValue(json(200, { speaker }));
    const client = createClient({ baseUrl: 'http://api', getToken: () => 't0k', fetch });

    await expect(client.renameSpeaker(SESSION, SPEAKER, 'Lan')).resolves.toEqual(speaker);

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(`http://api/v1/sessions/${SESSION}/speakers/${SPEAKER}`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ displayName: 'Lan' });
    expect(init.headers.authorization).toBe('Bearer t0k');
  });

  it('sends null to remove the name and maps errors to ApiError', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json(200, { speaker: { id: SPEAKER, label: 'speaker_2', displayName: null } }),
      )
      .mockResolvedValueOnce(json(404, { error: { code: 'NOT_FOUND', message: 'nope' } }));
    const client = createClient({ baseUrl: 'http://api', getToken: () => null, fetch });

    await client.renameSpeaker(SESSION, SPEAKER, null);
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ displayName: null });
    await expect(client.renameSpeaker(SESSION, SPEAKER, 'x')).rejects.toBeInstanceOf(ApiError);
  });
});
