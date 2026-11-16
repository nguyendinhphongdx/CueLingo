import {
  DEFAULT_USER_SETTINGS,
  UserSettingsSchema,
  TtsVoiceSchema,
  type LanguageCode,
  type TtsVoice,
  type UserSettings,
} from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

export interface SettingsRepository {
  /** Overlay and audio settings are the person's; the assist default belongs to one language. */
  get(userId: string, language: LanguageCode): Promise<UserSettings | null>;
  save(
    userId: string,
    settings: UserSettings,
    language: LanguageCode,
  ): Promise<UserSettings | null>;
  /** Only the chosen reading voice; null when the person has none saved (the default applies). */
  voice(userId: string): Promise<TtsVoice | null>;
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
    ttsVoice: stored.ttsVoice ?? DEFAULT_USER_SETTINGS.ttsVoice,
  });
}

export function createPostgresSettingsRepository(sql: Sql): SettingsRepository {
  return {
    async get(userId, language) {
      const [row] = await sql<SettingsRow[]>`
        SELECT COALESCE(learner_languages.assist_default, learner_profiles.assist_default)
                 AS "assistDefault",
               learner_profiles.settings
        FROM learner_profiles
        LEFT JOIN learner_languages
          ON learner_languages.user_id = learner_profiles.user_id
         AND learner_languages.language = ${language}
        WHERE learner_profiles.user_id = ${userId}`;
      return row ? fromRow(row) : null;
    },

    async voice(userId) {
      const [row] = await sql<Array<{ voice: unknown }>>`
        SELECT settings -> 'ttsVoice' AS voice FROM learner_profiles WHERE user_id = ${userId}`;
      const parsed = TtsVoiceSchema.safeParse(row?.voice);
      return parsed.success ? parsed.data : null;
    },

    async save(userId, settings, language) {
      const stored = {
        overlay: settings.overlay,
        saveAudio: settings.saveAudio,
        ttsVoice: settings.ttsVoice,
      };
      return sql.begin(async (tx) => {
        const [row] = await tx<SettingsRow[]>`
          UPDATE learner_profiles
          SET settings = settings || ${tx.json(stored)}
          WHERE user_id = ${userId}
          RETURNING assist_default AS "assistDefault", settings`;
        if (!row) return null;
        await tx`
          INSERT INTO learner_languages (user_id, language, assist_default)
          VALUES (${userId}, ${language}, ${settings.assistDefault})
          ON CONFLICT (user_id, language) DO UPDATE SET assist_default = EXCLUDED.assist_default`;
        return fromRow({ ...row, assistDefault: settings.assistDefault });
      });
    },
  };
}

export function createInMemorySettingsRepository(
  seed: Record<string, UserSettings> = {},
): SettingsRepository & { seed(userId: string, settings?: UserSettings): void } {
  // Overlay settings are per person; the assist default is per person and language.
  const values = new Map(Object.entries(seed));
  const assistByLanguage = new Map<string, UserSettings['assistDefault']>();
  return {
    seed(userId, settings = DEFAULT_USER_SETTINGS) {
      values.set(userId, structuredClone(settings));
    },
    async get(userId, language) {
      const settings = values.get(userId);
      if (!settings) return null;
      const assistDefault = assistByLanguage.get(`${userId}:${language}`) ?? settings.assistDefault;
      return structuredClone({ ...settings, assistDefault });
    },
    async voice(userId) {
      return values.get(userId)?.ttsVoice ?? null;
    },
    async save(userId, settings, language) {
      const current = values.get(userId);
      if (!current) return null;
      assistByLanguage.set(`${userId}:${language}`, settings.assistDefault);
      values.set(userId, structuredClone({ ...settings, assistDefault: current.assistDefault }));
      return structuredClone(settings);
    },
  };
}
