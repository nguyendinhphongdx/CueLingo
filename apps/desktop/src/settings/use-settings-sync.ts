import type { UserSettings } from '@cuelingo/shared';
import { useEffect } from 'react';
import { currentToken, useAuthStore } from '../auth/auth-store';
import { native } from '../lib/native';
import { storeOverlaySettings } from '../overlay/overlay-prefs';
import { settingsApi, type SettingsApi } from './settings-api';
import { useSettings } from './settings-store';

interface ApplySettingsDeps {
  setAssistLevel(level: UserSettings['assistDefault']): void;
  setNativeAssistLevel(level: UserSettings['assistDefault']): Promise<void>;
  publishAssistLevel(level: UserSettings['assistDefault']): Promise<void>;
  storeOverlay(overlay: UserSettings['overlay']): void;
}

/** Applies the account copy to both webviews and the native session default. */
export async function applyLoadedSettings(
  settings: UserSettings,
  deps: ApplySettingsDeps = {
    setAssistLevel: useSettings.getState().setAssistLevel,
    setNativeAssistLevel: native.setAssistLevel,
    publishAssistLevel: (assistLevel) => native.publishSettings({ assistLevel }),
    storeOverlay: storeOverlaySettings,
  },
) {
  deps.setAssistLevel(settings.assistDefault);
  deps.storeOverlay(settings.overlay);
  await deps.setNativeAssistLevel(settings.assistDefault);
  await deps.publishAssistLevel(settings.assistDefault);
}

/** Loads once credentials are ready. A network failure leaves the safe local defaults in place. */
export function useSettingsSync(api: SettingsApi = settingsApi) {
  const status = useAuthStore((state) => state.status);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (status === 'loading' || currentToken() === '') return;
    let disposed = false;
    void api
      .get()
      .then((settings) => (disposed ? undefined : applyLoadedSettings(settings)))
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [api, status, token]);
}
