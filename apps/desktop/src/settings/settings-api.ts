import { ApiError } from '@cuelingo/core-sdk';
import {
  ErrorResponseSchema,
  UpdateUserSettingsSchema,
  UserSettingsSchema,
  type UpdateUserSettings,
  type UserSettings,
} from '@cuelingo/shared';
import { currentToken } from '../auth/auth-store';
import { resolveToken, type TokenSource } from '../auth/token';

type Fetch = typeof fetch;

export interface SettingsApi {
  get(): Promise<UserSettings>;
  update(patch: UpdateUserSettings): Promise<UserSettings>;
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

  async function call(method: 'GET' | 'PATCH', body?: UpdateUserSettings) {
    let response: Response;
    try {
      response = await request(`${baseUrl}/v1/me/settings`, {
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
    get: () => call('GET'),
    update: (patch) => call('PATCH', patch),
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
export function createDebouncedSettingsSaver(api: SettingsApi, delay = 800) {
  let pending: UpdateUserSettings = {};
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = async () => {
    timer = undefined;
    const patch = pending;
    pending = {};
    try {
      await api.update(patch);
    } catch {
      pending = mergeSettingsPatch(patch, pending);
    }
  };

  return {
    schedule(patch: UpdateUserSettings) {
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

const saver = createDebouncedSettingsSaver(settingsApi);
export const queueSettingsPatch = (patch: UpdateUserSettings) => saver.schedule(patch);
