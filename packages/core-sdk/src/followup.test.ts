import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient } from './index';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const input = { channel: 'email' as const, tone: 'polite' as const };

describe('followup client', () => {
  it('posts the request to the session and parses the draft', async () => {
    const draft = { subject: 'Recap', body: 'Thanks all.', language: 'en' };
    const fetch = vi.fn().mockResolvedValue(json(200, draft));
    const client = createClient({ baseUrl: 'http://api', getToken: () => 't0k', fetch });

    const result = await client.followup('sess-1', input);

    expect(result).toEqual(draft);
    expect(fetch.mock.calls[0]?.[0]).toBe('http://api/v1/sessions/sess-1/followup');
    expect(fetch.mock.calls[0]?.[1].method).toBe('POST');
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual(input);
  });

  it('surfaces FOLLOWUP_FAILED', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(json(502, { error: { code: 'FOLLOWUP_FAILED', message: 'failed' } }));
    const client = createClient({ baseUrl: 'http://api', getToken: () => 't0k', fetch });

    const error = await client.followup('sess-1', input).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 'FOLLOWUP_FAILED' });
  });
});
