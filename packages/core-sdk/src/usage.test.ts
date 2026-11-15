import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient } from './index';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const item = { used: 0, limit: null, resetsAt: '2026-12-01T00:00:00.000Z', state: 'ok' };
const usage = {
  plan: 'free',
  usage: {
    translation_ms: item,
    cloud_stt_ms: item,
    debriefs: item,
    assist_daily: item,
    agent_messages: item,
  },
};

describe('usage client', () => {
  it('reads the usage with the token', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, usage));
    const client = createClient({ baseUrl: 'http://api', getToken: () => 't0k', fetch });

    const result = await client.usage.get();

    expect(result.plan).toBe('free');
    expect(fetch.mock.calls[0]?.[0]).toBe('http://api/v1/me/usage');
    expect(fetch.mock.calls[0]?.[1].headers.authorization).toBe('Bearer t0k');
  });

  it('puts the plan by email and parses the answer', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { email: 'a@b.co', plan: 'pro' }));
    const client = createClient({ baseUrl: 'http://api', getToken: () => 't', fetch });

    expect(await client.usage.setPlan({ email: 'a@b.co', plan: 'pro' })).toEqual({
      email: 'a@b.co',
      plan: 'pro',
    });
    expect(fetch.mock.calls[0]?.[1].method).toBe('PUT');
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({ email: 'a@b.co', plan: 'pro' });
  });

  it('keeps the allowance in the error details of QUOTA_EXCEEDED', async () => {
    const details = {
      metric: 'cloud_stt_ms',
      plan: 'free',
      used: 3_600_000,
      limit: 3_600_000,
      resetsAt: '2026-12-01T00:00:00.000Z',
    };
    const fetch = vi
      .fn()
      .mockResolvedValue(json(429, { error: { code: 'QUOTA_EXCEEDED', message: 'x', details } }));
    const client = createClient({ baseUrl: 'http://api', getToken: () => 't', fetch });

    const error = await client.usage.get().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, code: 'QUOTA_EXCEEDED', details });
  });
});
