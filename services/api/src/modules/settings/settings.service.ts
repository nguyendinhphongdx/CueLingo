import {
  ErrorCode,
  UserSettingsSchema,
  type UpdateUserSettings,
  type UserSettings,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { SettingsRepository } from './settings.repository';

export type SettingsService = ReturnType<typeof createSettingsService>;

export function mergeUserSettings(current: UserSettings, patch: UpdateUserSettings): UserSettings {
  return UserSettingsSchema.parse({
    ...current,
    ...patch,
    overlay: { ...current.overlay, ...patch.overlay },
  });
}

export function createSettingsService(repo: SettingsRepository) {
  const missing = () => new AppError(ErrorCode.NotFound, 'Learner profile not found');

  return {
    async get(userId: string): Promise<UserSettings> {
      return (await repo.get(userId)) ?? Promise.reject(missing());
    },
    async update(userId: string, patch: UpdateUserSettings): Promise<UserSettings> {
      const current = await repo.get(userId);
      if (!current) throw missing();
      return (
        (await repo.save(userId, mergeUserSettings(current, patch))) ?? Promise.reject(missing())
      );
    },
  };
}
