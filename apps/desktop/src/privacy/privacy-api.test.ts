import { describe, expect, it, vi } from 'vitest';
import { canConfirmDelete } from './PrivacyPanel';
import { createPrivacyApi } from './privacy-api';

describe('desktop privacy', () => {
  it('sends authenticated export and confirmed deletion requests', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          exportedAt: '2026-11-06T09:00:00.000Z',
          sessions: [],
          phrases: [],
          glossaryTerms: [],
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = createPrivacyApi({ apiUrl: 'ws://api.test/', token: 'secret', fetch: request });

    await api.exportData();
    await api.deleteMyData({ confirm: 'XOA DU LIEU' });

    expect(request.mock.calls[0]?.[0]).toBe('http://api.test/v1/me/export');
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      method: 'DELETE',
      body: JSON.stringify({ confirm: 'XOA DU LIEU' }),
    });
    expect(request.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer secret',
    });
  });

  it('requires the exact second-step confirmation phrase', () => {
    expect(canConfirmDelete('XOA DU LIEU')).toBe(true);
    expect(canConfirmDelete('xoa du lieu')).toBe(false);
    expect(canConfirmDelete('')).toBe(false);
  });
});
