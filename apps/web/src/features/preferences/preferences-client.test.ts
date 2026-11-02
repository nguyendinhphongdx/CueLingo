import { DEFAULT_USER_SETTINGS } from '@cuelingo/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { client } from '../../lib/client';

afterEach(() => vi.unstubAllGlobals());

describe('preferences client', () => {
  it('loads and saves the shared settings contract', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify(DEFAULT_USER_SETTINGS), { status: 200 }),
      );
    vi.stubGlobal('fetch', request);

    expect(await client.settings.get('en')).toEqual(DEFAULT_USER_SETTINGS);
    await client.settings.update({ ...DEFAULT_USER_SETTINGS, saveAudio: true }, 'ja');
    expect(request).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/v1\/me\/settings\?language=ja$/),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ ...DEFAULT_USER_SETTINGS, saveAudio: true }),
      }),
    );
  });
});
