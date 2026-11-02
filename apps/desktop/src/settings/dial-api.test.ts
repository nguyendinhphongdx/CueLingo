import { describe, expect, it, vi } from 'vitest';
import { createDialApi } from './dial-api';

describe('dial api', () => {
  it('reads the suggestion with the bearer token', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        kind: 'lower',
        currentLevel: 4,
        suggestedLevel: 3,
        meetingsConsidered: 3,
        avgComprehensionPct: 88,
      }),
    );
    const api = createDialApi({
      apiUrl: 'http://api.test',
      token: () => 'cld_token',
      fetch: fetcher as unknown as typeof fetch,
    });

    const suggestion = await api.suggestion();

    expect(suggestion).toMatchObject({ kind: 'lower', suggestedLevel: 3 });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/v1/me/assist-suggestion?language=en');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer cld_token');
  });

  it('rejects an answer that is not a suggestion and a failed request', async () => {
    const bad = createDialApi({
      apiUrl: 'http://api.test',
      token: 't',
      fetch: (async () => Response.json({ kind: 'lower' })) as unknown as typeof fetch,
    });
    await expect(bad.suggestion()).rejects.toThrow();

    const down = createDialApi({
      apiUrl: 'http://api.test',
      token: 't',
      fetch: (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch,
    });
    await expect(down.suggestion()).rejects.toThrow('500');
  });
});
