import { DEFAULT_USER_SETTINGS, UserSettingsSchema, type UserSettings } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

export interface SettingsRepository {
  get(userId: string): Promise<UserSettings | null>;
  save(userId: string, settings: UserSettings): Promise<UserSettings | null>;
}

interface SettingsRow {
  assistDefault: number;
  settings: unknown;
}

function fromRow(row: SettingsRow): UserSettings {
  const stored =
    typeof row.settings === 'object' && row.settings !== null
      ? (row.settings as Record<string, unknown>)
      : {};
  const overlay =
    typeof stored.overlay === 'object' && stored.overlay !== null
      ? (stored.overlay as Record<string, unknown>)
      : {};
  return UserSettingsSchema.parse({
    ...DEFAULT_USER_SETTINGS,
    assistDefault: row.assistDefault,
    overlay: { ...DEFAULT_USER_SETTINGS.overlay, ...overlay },
    saveAudio: stored.saveAudio ?? DEFAULT_USER_SETTINGS.saveAudio,
  });
}

export function createPostgresSettingsRepository(sql: Sql): SettingsRepository {
  return {
    async get(userId) {
      const [row] = await sql<SettingsRow[]>`
        SELECT assist_default AS "assistDefault", settings
        FROM learner_profiles
        WHERE user_id = ${userId}`;
      return row ? fromRow(row) : null;
    },

    async save(userId, settings) {
      const stored = { overlay: settings.overlay, saveAudio: settings.saveAudio };
      const [row] = await sql<SettingsRow[]>`
        UPDATE learner_profiles
        SET assist_default = ${settings.assistDefault},
            settings = settings || ${sql.json(stored)}
        WHERE user_id = ${userId}
        RETURNING assist_default AS "assistDefault", settings`;
      return row ? fromRow(row) : null;
    },
  };
}

export function createInMemorySettingsRepository(
  seed: Record<string, UserSettings> = {},
): SettingsRepository & { seed(userId: string, settings?: UserSettings): void } {
  const values = new Map(Object.entries(seed));
  return {
    seed(userId, settings = DEFAULT_USER_SETTINGS) {
      values.set(userId, structuredClone(settings));
    },
    async get(userId) {
      const settings = values.get(userId);
      return settings ? structuredClone(settings) : null;
    },
    async save(userId, settings) {
      if (!values.has(userId)) return null;
      values.set(userId, structuredClone(settings));
      return structuredClone(settings);
    },
  };
}
