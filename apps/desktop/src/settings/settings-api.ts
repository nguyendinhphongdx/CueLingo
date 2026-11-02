import { ApiError } from '@cuelingo/core-sdk';
import {
  DEFAULT_LANGUAGE,
  ErrorResponseSchema,
  UpdateUserSettingsSchema,
  UserSettingsSchema,
  type LanguageCode,
  type UpdateUserSettings,
  type UserSettings,
} from '@cuelingo/shared';
import { currentToken } from '../auth/auth-store';
import { resolveToken, type TokenSource } from '../auth/token';
import { useSettings } from './settings-store';

type Fetch = typeof fetch;

export interface SettingsApi {
  /** The assist default is per language; everything else is the person's. */
  get(language?: LanguageCode): Promise<UserSettings>;
  update(patch: UpdateUserSettings, language?: LanguageCode): Promise<UserSettings>;
}

interface SettingsApiOptions {
  apiUrl: string;
  token: TokenSource;
  fetch?: Fetch;
}

export function createSettingsApi({
  apiUrl,
  token,
  fetch: request = fetch,
}: SettingsApiOptions): SettingsApi {
  const baseUrl = apiUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:').replace(/\/$/, '');

  async function call(method: 'GET' | 'PATCH', language: LanguageCode, body?: UpdateUserSettings) {
    let response: Response;
    try {
      response = await request(`${baseUrl}/v1/me/settings?language=${language}`, {
        method,
        headers: {
          Authorization: `Bearer ${resolveToken(token)}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(UpdateUserSettingsSchema.parse(body)) : undefined,
      });
    } catch (error) {
      throw new ApiError(0, 'NETWORK_ERROR', (error as Error).message);
    }

    if (!response.ok) {
      const parsed = ErrorResponseSchema.safeParse(await response.json().catch(() => null));
      if (parsed.success) {
        throw new ApiError(
          response.status,
          parsed.data.error.code,
          parsed.data.error.message,
          parsed.data.error.details,
        );
      }
      throw new ApiError(response.status, 'INTERNAL_ERROR', `HTTP ${response.status}`);
    }
    return UserSettingsSchema.parse(await response.json());
  }

  return {
    get: (language = DEFAULT_LANGUAGE) => call('GET', language),
    update: (patch, language = DEFAULT_LANGUAGE) => call('PATCH', language, patch),
  };
}

export function mergeSettingsPatch(
  current: UpdateUserSettings,
  next: UpdateUserSettings,
): UpdateUserSettings {
  return {
    ...current,
    ...next,
    overlay: current.overlay || next.overlay ? { ...current.overlay, ...next.overlay } : undefined,
  };
}

/** Coalesces rapid local changes and waits for a future change before retrying a failed request. */
export function createDebouncedSettingsSaver(
  api: SettingsApi,
  delay = 800,
  currentLanguage: () => LanguageCode = () => DEFAULT_LANGUAGE,
) {
  let pending: UpdateUserSettings = {};
  let pendingLanguage: LanguageCode = currentLanguage();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = async () => {
    timer = undefined;
    const patch = pending;
    const language = pendingLanguage;
    pending = {};
    try {
      await api.update(patch, language);
    } catch {
      pending = mergeSettingsPatch(patch, pending);
      pendingLanguage = language;
    }
  };

  return {
    schedule(patch: UpdateUserSettings) {
      // A change for another language than the waiting one is saved first, so it lands in the right place.
      if (timer && pendingLanguage !== currentLanguage()) {
        clearTimeout(timer);
        void flush();
      }
      pendingLanguage = currentLanguage();
      pending = mergeSettingsPatch(pending, UpdateUserSettingsSchema.parse(patch));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), delay);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      pending = {};
    },
  };
}

export const settingsApi = createSettingsApi({
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  token: currentToken,
});

const saver = createDebouncedSettingsSaver(settingsApi, 800, () => useSettings.getState().language);
export const queueSettingsPatch = (patch: UpdateUserSettings) => saver.schedule(patch);
