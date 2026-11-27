import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient } from './index';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const ID = '0b9f2f5e-7c52-4d57-9d4c-1f5f3a7a9a10';
const row = {
  id: ID,
  email: 'a@example.com',
  name: 'A',
  createdAt: '2026-11-01T00:00:00.000Z',
  plan: 'free',
  source: null,
  expiresAt: null,
  translationMsThisMonth: 0,
  lastActiveAt: null,
};
const item = (used: number) => ({
  used,
  limit: null,
  resetsAt: '2026-12-01T00:00:00.000Z',
  state: 'ok',
});
const usage = {
  plan: 'free',
  usage: {
    translation_ms: item(0),
    cloud_stt_ms: item(0),
    debriefs: item(0),
    assist_daily: item(0),
    agent_messages: item(0),
    lessons_daily: item(0),
    lesson_practice_daily: item(0),
    meeting_ask_daily: item(0),
  },
};
const make = (fetch: ReturnType<typeof vi.fn>) =>
  createClient({
    baseUrl: 'http://api',
    getToken: () => 't0k',
    fetch: fetch as unknown as typeof globalThis.fetch,
  });

describe('admin client', () => {
  it('asks whether the caller is an admin and calls the four analytics routes', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { isAdmin: false }));
    const client = make(fetch);
    expect(await client.admin.access()).toEqual({ isAdmin: false });
    expect(fetch.mock.calls[0]?.[0]).toBe('http://api/v1/admin/me');
    for (const name of ['overview', 'revenue', 'usage', 'activity'] as const) {
      fetch.mockResolvedValueOnce(json(200, { nope: true }));
      await expect(client.admin.analytics[name]()).rejects.toBeDefined();
      expect(fetch.mock.calls.at(-1)?.[0]).toBe(`http://api/v1/admin/analytics/${name}`);
    }
  });

  it('sends the quota filter on the user list', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { items: [], nextCursor: null }));
    await make(fetch).admin.users.list({ metric: 'debriefs', atLeast: '80' });
    expect(fetch.mock.calls[0]?.[0]).toBe('http://api/v1/admin/users?metric=debriefs&atLeast=80');
  });

  it('reads the dashboard', async () => {
    const fetch = vi.fn().mockResolvedValue(
      json(200, {
        generatedAt: '2026-11-15T00:00:00.000Z',
        totalUsers: 1,
        byPlan: { free: 1, pro: 0, ultra: 0 },
        newUsers7d: 0,
        revenueThisMonth: 0,
        expiringIn7d: 0,
      }),
    );
    const result = await make(fetch).admin.dashboard();
    expect(result.totalUsers).toBe(1);
    expect(fetch.mock.calls[0]?.[0]).toBe('http://api/v1/admin/dashboard');
    expect(fetch.mock.calls[0]?.[1].headers.authorization).toBe('Bearer t0k');
  });

  it('lists with only the filters that are set, encoded', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => json(200, { items: [row], nextCursor: null }));
    const client = make(fetch);
    await client.admin.users.list();
    await client.admin.users.list({ q: 'a&b c', plan: 'pro', expiring: '1', cursor: 'x+/=' });
    await client.admin.users.list({ q: '' });
    expect(fetch.mock.calls[0]?.[0]).toBe('http://api/v1/admin/users');
    const url = new URL(String(fetch.mock.calls[1]?.[0]));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'a&b c',
      plan: 'pro',
      expiring: '1',
      cursor: 'x+/=',
    });
    expect(fetch.mock.calls[2]?.[0]).toBe('http://api/v1/admin/users');
  });

  it('reads one person and sets the plan by id with a PUT', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(200, { user: row, usage, orders: [] }))
      .mockResolvedValueOnce(json(200, { plan: 'pro', source: 'manual', expiresAt: null }));
    const client = make(fetch);
    expect((await client.admin.users.get(ID)).user.email).toBe('a@example.com');
    expect(fetch.mock.calls[0]?.[0]).toBe(`http://api/v1/admin/users/${ID}`);
    const done = await client.admin.users.setPlan(ID, { plan: 'pro', period: 'month' });
    expect(done.source).toBe('manual');
    expect(fetch.mock.calls[1]?.[0]).toBe(`http://api/v1/admin/users/${ID}/plan`);
    expect(fetch.mock.calls[1]?.[1].method).toBe('PUT');
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toEqual({ plan: 'pro', period: 'month' });
  });

  it('keeps the status of a refusal and fails loudly on a contract break', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(403, { error: { code: 'FORBIDDEN', message: 'x' } }))
      .mockResolvedValueOnce(
        json(200, { items: [{ ...row, title: 'Board meeting' }], nextCursor: null }),
      );
    const client = make(fetch);
    const error = await client.admin.users.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403 });
    await expect(client.admin.users.list()).rejects.toThrow();
  });
});
