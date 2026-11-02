import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedSettingsSaver, createSettingsApi } from './settings-api';

const settings = {
  assistDefault: 4 as const,
  overlay: { fontSize: 18, opacity: 88, theme: 'dark' as const },
  saveAudio: false,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => vi.useRealTimers());

describe('desktop settings api', () => {
  it('loads settings with the current device token', async () => {
    let token = 'first-token';
    const request = vi.fn<typeof fetch>().mockImplementation(async () => json(settings));
    const api = createSettingsApi({
      apiUrl: 'ws://localhost:4000/',
      token: () => token,
      fetch: request,
    });

    expect(await api.get()).toEqual(settings);
    token = 'second-token';
    await api.get();
    expect(request).toHaveBeenNthCalledWith(
      2,
      'http://localhost:4000/v1/me/settings',
      expect.objectContaining({ headers: { Authorization: 'Bearer second-token' }, method: 'GET' }),
    );
  });

  it('sends only the last merged patch after 800 ms (AC5)', async () => {
    vi.useFakeTimers();
    const update = vi.fn(async () => settings);
    const saver = createDebouncedSettingsSaver({ get: async () => settings, update });

    saver.schedule({ assistDefault: 3 });
    await vi.advanceTimersByTimeAsync(400);
    saver.schedule({ assistDefault: 1, overlay: { fontSize: 20 } });
    await vi.advanceTimersByTimeAsync(799);
    expect(update).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith({ assistDefault: 1, overlay: { fontSize: 20 } });
  });

  it('keeps a failed patch for the next local change without retrying immediately', async () => {
    vi.useFakeTimers();
    const update = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(settings);
    const saver = createDebouncedSettingsSaver({ get: async () => settings, update });

    saver.schedule({ overlay: { opacity: 70 } });
    await vi.advanceTimersByTimeAsync(800);
    expect(update).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(update).toHaveBeenCalledOnce();

    saver.schedule({ saveAudio: true });
    await vi.advanceTimersByTimeAsync(800);
    expect(update).toHaveBeenLastCalledWith({ overlay: { opacity: 70 }, saveAudio: true });
  });
});
