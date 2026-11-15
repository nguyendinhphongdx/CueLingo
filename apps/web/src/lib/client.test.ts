import { afterEach, describe, expect, it, vi } from 'vitest';
import { client } from './client';

afterEach(() => vi.unstubAllGlobals());

describe('web client admin keys', () => {
  it('keeps the web-only admin calls and the core-sdk ones side by side', () => {
    expect(client.admin.metrics).toBeTypeOf('function');
    expect(client.admin.agent.get).toBeTypeOf('function');
    expect(client.admin.invites.list).toBeTypeOf('function');
    expect(client.admin.dashboard).toBeTypeOf('function');
    expect(client.admin.users.list).toBeTypeOf('function');
    expect(client.admin.users.get).toBeTypeOf('function');
    expect(client.admin.users.setPlan).toBeTypeOf('function');
  });

  it('sends client.admin.users.list to the API with the session cookie', async () => {
    const fetch = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ items: [], nextCursor: null }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    // The core client reads the global `fetch` when it is created, so load a fresh copy after stubbing.
    vi.stubGlobal('fetch', fetch);
    vi.resetModules();
    const fresh = await import('./client');
    const page = await fresh.client.admin.users.list({ q: 'an', plan: 'pro' });
    expect(page).toEqual({ items: [], nextCursor: null });
    expect(String(fetch.mock.calls[0]?.[0])).toMatch(/\/v1\/admin\/users\?q=an&plan=pro$/);
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', credentials: 'include' });
  });
});
