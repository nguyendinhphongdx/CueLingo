import { afterEach, describe, expect, it, vi } from 'vitest';
import { client } from '../../lib/client';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const me = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Lan Anh',
  email: 'lan@example.com',
  createdAt: '2026-11-01T00:00:00.000Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('account client', () => {
  it('trims a name before PATCH /v1/me', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(json(me));
    vi.stubGlobal('fetch', request);

    expect(await client.me.update({ name: '  Lan Anh  ' })).toEqual(me);
    expect(request).toHaveBeenCalledWith(
      expect.stringMatching(/\/v1\/me$/),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Lan Anh' }) }),
    );
  });

  it('loads devices and revokes the selected device token', async () => {
    const device = {
      id: '22222222-2222-4222-8222-222222222222',
      label: 'MacBook của Lan',
      createdAt: '2026-11-01T00:00:00.000Z',
      lastUsedAt: null,
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ devices: [device] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', request);

    expect(await client.device.listTokens()).toEqual({ devices: [device] });
    await client.device.revokeToken(device.id);

    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(new RegExp(`/v1/device/tokens/${device.id}$`)),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
