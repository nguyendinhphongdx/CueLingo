import { DEFAULT_USER_SETTINGS, type UserSettings } from '@cuelingo/shared';
import { describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemorySettingsRepository } from './settings.repository';

const ALICE = '00000000-0000-4000-8000-0000000000a1';
const BOB = '00000000-0000-4000-8000-0000000000b1';
const as = (user: string) => ({ [TEST_USER_HEADER]: user });

async function setup() {
  const settings = createInMemorySettingsRepository();
  settings.seed(ALICE);
  settings.seed(BOB, {
    assistDefault: 1,
    overlay: { fontSize: 22, opacity: 70, theme: 'light' },
    saveAudio: true,
  });
  const app = await buildTestApp({ repos: { settings } });
  return { app, settings };
}

describe('settings routes', () => {
  it('returns defaults and deep-merges a partial patch (AC1)', async () => {
    const { app } = await setup();
    const initial = await app.inject({ method: 'GET', url: '/v1/me/settings', headers: as(ALICE) });
    expect(initial.statusCode).toBe(200);
    expect(initial.json()).toEqual(DEFAULT_USER_SETTINGS);

    const patched = await app.inject({
      method: 'PATCH',
      url: '/v1/me/settings',
      headers: as(ALICE),
      payload: { overlay: { fontSize: 24 } },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toEqual({
      ...DEFAULT_USER_SETTINGS,
      overlay: { ...DEFAULT_USER_SETTINGS.overlay, fontSize: 24 },
    });
    await app.close();
  });

  it('rejects invalid values and unknown keys without writing (AC2)', async () => {
    const { app, settings } = await setup();
    const before = await settings.get(ALICE);
    for (const payload of [
      { overlay: { fontSize: 99 } },
      { assistDefault: 2 },
      { overlay: { theme: 'system' } },
      { unknown: true },
      { overlay: { opacity: 90, unknown: true } },
    ]) {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/me/settings',
        headers: as(ALICE),
        payload,
      });
      expect(response.statusCode, JSON.stringify(payload)).toBe(400);
      expect(await settings.get(ALICE)).toEqual(before);
    }
    await app.close();
  });

  it("never reads or changes another user's settings (AC3)", async () => {
    const { app, settings } = await setup();
    const bobBefore = await settings.get(BOB);
    await app.inject({
      method: 'PATCH',
      url: '/v1/me/settings',
      headers: as(ALICE),
      payload: { assistDefault: 0, saveAudio: true },
    });

    const bob = await app.inject({ method: 'GET', url: '/v1/me/settings', headers: as(BOB) });
    expect(bob.json()).toEqual(bobBefore);
    expect((await settings.get(ALICE))?.assistDefault).toBe(0);
    await app.close();
  });

  it('requires authentication and returns 404 without a learner profile', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'GET', url: '/v1/me/settings' })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/v1/me/settings',
          headers: as('00000000-0000-4000-8000-000000000099'),
        })
      ).statusCode,
    ).toBe(404);
    await app.close();
  });
});

const _contractCheck: UserSettings = DEFAULT_USER_SETTINGS;
void _contractCheck;
