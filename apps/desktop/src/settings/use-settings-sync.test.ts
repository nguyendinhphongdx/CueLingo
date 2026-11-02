import { describe, expect, it, vi } from 'vitest';
import { applyLoadedSettings } from './use-settings-sync';

describe('settings sync', () => {
  it('applies downloaded settings to the store, native layer and overlay storage (AC4)', async () => {
    const settings = {
      assistDefault: 3 as const,
      overlay: { fontSize: 24, opacity: 72, theme: 'light' as const },
      saveAudio: true,
    };
    const setAssistLevel = vi.fn();
    const setNativeAssistLevel = vi.fn(async () => {});
    const publishAssistLevel = vi.fn(async () => {});
    const storeOverlay = vi.fn();

    await applyLoadedSettings(settings, {
      setAssistLevel,
      setNativeAssistLevel,
      publishAssistLevel,
      storeOverlay,
    });

    expect(setAssistLevel).toHaveBeenCalledWith(3);
    expect(setNativeAssistLevel).toHaveBeenCalledWith(3);
    expect(publishAssistLevel).toHaveBeenCalledWith(3);
    expect(storeOverlay).toHaveBeenCalledWith(settings.overlay);
  });
});
