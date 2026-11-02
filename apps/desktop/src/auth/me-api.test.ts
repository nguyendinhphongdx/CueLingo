import { describe, expect, it, vi } from 'vitest';
import { createMeApi, describeMeError } from './me-api';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('desktop me api', () => {
  it('loads /v1/me with the current device token', async () => {
    let token = 'first-token';
    const me = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Lan Anh',
      email: 'lan@example.com',
      createdAt: '2026-11-01T00:00:00.000Z',
    };
    const request = vi.fn<typeof fetch>().mockImplementation(async () => json(me));
    const api = createMeApi({
      apiUrl: 'ws://localhost:4000/',
      token: () => token,
      fetch: request,
    });

    expect(await api.get()).toEqual(me);
    token = 'second-token';
    await api.get();

    expect(request).toHaveBeenNthCalledWith(
      2,
      'http://localhost:4000/v1/me',
      expect.objectContaining({ headers: { Authorization: 'Bearer second-token' } }),
    );
  });

  it('turns a network failure into a small Vietnamese message', async () => {
    const api = createMeApi({
      apiUrl: 'http://localhost:4000',
      token: 'token',
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
    });

    await expect(api.get()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    try {
      await api.get();
    } catch (error) {
      expect(describeMeError(error)).toBe('Không kết nối được tới máy chủ.');
    }
  });
});
