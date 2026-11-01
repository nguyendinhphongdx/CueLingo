import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAssistApi } from './assist-api';

const lookupResponse = {
  term: 'review',
  meaningVi: 'xem lại',
  exampleEn: 'Let us review the plan.',
};

describe('assist api', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the configured URL and bearer token for every network call', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(lookupResponse))
      .mockResolvedValueOnce(Response.json({ summaryVi: 'Tóm tắt', bulletsVi: [] }))
      .mockResolvedValueOnce(Response.json({ options: [{ en: 'I agree.' }] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = createAssistApi({
      apiUrl: 'ws://api.test/',
      token: 'secret-token',
      fetch: request,
    });

    await api.lookup({ term: 'review', context: 'Let us review the plan.' });
    await api.recap({ sentences: [{ text: 'The plan is ready.' }] });
    await api.compose({ intentVi: 'Tôi đồng ý.' });
    await api.record({ type: 'recap_used', at: '2026-11-01T00:00:00.000Z' });

    expect(request.mock.calls.map(([url]) => url)).toEqual([
      'http://api.test/v1/assist/lookup',
      'http://api.test/v1/assist/recap',
      'http://api.test/v1/assist/compose',
      'http://api.test/v1/events',
    ]);
    for (const [, init] of request.mock.calls) {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret-token' });
    }
  });

  it('parses responses with the shared schema', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        ...lookupResponse,
        unexpected: true,
      }),
    );
    const api = createAssistApi({ apiUrl: 'https://api.test', token: 'token', fetch: request });

    await expect(api.lookup({ term: 'review' })).rejects.toThrow();
  });

  it('rejects non-success responses', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    const api = createAssistApi({ apiUrl: 'https://api.test', token: 'token', fetch: request });

    await expect(api.compose({ intentVi: 'Tôi đồng ý.' })).rejects.toThrow('503');
  });
});
