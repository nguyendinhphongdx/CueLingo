/** Settings — persistent preferences for the signed-in learner. */
import { settingsRoutes } from './settings.routes';
import { createSettingsService } from './settings.service';
import type { SettingsRepository } from './settings.repository';

export function createSettingsModule(repo: SettingsRepository) {
  const settings = createSettingsService(repo);
  return { settings, routes: settingsRoutes(settings) };
}

export type { SettingsRepository } from './settings.repository';
export {
  createInMemorySettingsRepository,
  createPostgresSettingsRepository,
} from './settings.repository';
