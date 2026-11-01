import { DEVICE_TOKEN_PREFIX } from '@cuelingo/shared';
import { describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryDeviceRepository } from './device.repository';
import { CODE_TTL_SECONDS, createDeviceService } from './device.service';

const as = (user: string) => ({ [TEST_USER_HEADER]: user });

describe('device service', () => {
  it('issues a code that exchanges once for a token', async () => {
    const service = createDeviceService(createInMemoryDeviceRepository());
    const { code } = await service.issueCode('alice');

    const { token } = await service.exchange(code, 'CueLingo cho macOS');
    expect(token.startsWith(DEVICE_TOKEN_PREFIX)).toBe(true);
    expect(await service.verifyToken(token)).toBe('alice');
    await expect(service.exchange(code, undefined)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects an expired code', async () => {
    let now = new Date('2026-11-05T09:00:00Z');
    const service = createDeviceService(createInMemoryDeviceRepository(), () => now);
    const { code } = await service.issueCode('alice');
    now = new Date(now.getTime() + (CODE_TTL_SECONDS + 1) * 1000);
    await expect(service.exchange(code, undefined)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('knows nothing about a made-up token and ignores tokens without the prefix', async () => {
    const service = createDeviceService(createInMemoryDeviceRepository());
    expect(await service.verifyToken(`${DEVICE_TOKEN_PREFIX}nope`)).toBeNull();
    expect(await service.verifyToken('dev-token')).toBeNull();
  });

  it('stores only hashes: the repository never sees the raw code or token', async () => {
    const seen: string[] = [];
    const repo = createInMemoryDeviceRepository();
    const spy = {
      ...repo,
      createCode: async (u: string, hash: string, at: Date) => {
        seen.push(hash);
        return repo.createCode(u, hash, at);
      },
      createToken: async (u: string, hash: string, label: string | null) => {
        seen.push(hash);
        return repo.createToken(u, hash, label);
      },
    };
    const service = createDeviceService(spy);
    const { code } = await service.issueCode('alice');
    const { token } = await service.exchange(code, undefined);
    expect(seen).toHaveLength(2);
    expect(seen).not.toContain(code);
    expect(seen).not.toContain(token);
    expect(seen.every((hash) => /^[0-9a-f]{64}$/.test(hash))).toBe(true);
  });

  it('revokes a token: it stops working, and only its owner can revoke it', async () => {
    const service = createDeviceService(createInMemoryDeviceRepository());
    const { token } = await service.exchange((await service.issueCode('alice')).code, 'Mac');
    const [device] = await service.list('alice');

    await expect(service.revoke('bob', device!.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await service.revoke('alice', device!.id);
    expect(await service.verifyToken(token)).toBeNull();
  });
});

describe('device routes', () => {
  it('walks the sign-in: session mints a code, the app exchanges it, the token works', async () => {
    const app = await buildTestApp();
    const minted = await app.inject({
      method: 'POST',
      url: '/v1/device/code',
      headers: as('alice'),
    });
    expect(minted.statusCode).toBe(200);
    const { code } = minted.json();

    // The app has no credentials yet, so the exchange is public.
    const exchanged = await app.inject({
      method: 'POST',
      url: '/v1/device/exchange',
      payload: { code, label: 'CueLingo cho macOS' },
    });
    expect(exchanged.statusCode).toBe(200);
    const { token } = exchanged.json();

    const withToken = await app.inject({
      method: 'GET',
      url: '/v1/progress',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(withToken.statusCode).toBe(200);

    const reused = await app.inject({
      method: 'POST',
      url: '/v1/device/exchange',
      payload: { code },
    });
    expect(reused.statusCode).toBe(401);
    await app.close();
  });

  it('keeps a device token from minting codes or listing devices', async () => {
    const app = await buildTestApp();
    const { code } = (
      await app.inject({ method: 'POST', url: '/v1/device/code', headers: as('alice') })
    ).json();
    const { token } = (
      await app.inject({ method: 'POST', url: '/v1/device/exchange', payload: { code } })
    ).json();

    for (const [method, url] of [
      ['POST', '/v1/device/code'],
      ['GET', '/v1/device/tokens'],
    ] as const) {
      const response = await app.inject({
        method,
        url,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(401);
    }
    await app.close();
  });

  it('signs the device out: DELETE /v1/device/token revokes the bearer token', async () => {
    const app = await buildTestApp();
    const { code } = (
      await app.inject({ method: 'POST', url: '/v1/device/code', headers: as('alice') })
    ).json();
    const { token } = (
      await app.inject({ method: 'POST', url: '/v1/device/exchange', payload: { code } })
    ).json();
    const headers = { authorization: `Bearer ${token}` };

    expect(
      (await app.inject({ method: 'DELETE', url: '/v1/device/token', headers })).statusCode,
    ).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/v1/progress', headers })).statusCode).toBe(
      401,
    );
    await app.close();
  });

  it('rejects a malformed exchange body and requires a session to mint', async () => {
    const app = await buildTestApp();
    expect(
      (await app.inject({ method: 'POST', url: '/v1/device/exchange', payload: { code: 'x' } }))
        .statusCode,
    ).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/v1/device/code' })).statusCode).toBe(401);
    await app.close();
  });
});
