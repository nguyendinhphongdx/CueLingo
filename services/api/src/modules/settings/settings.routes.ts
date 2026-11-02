import { LanguageQuerySchema, UpdateUserSettingsSchema, type UserSettings } from '@cuelingo/shared';
import type { FastifyPluginAsync } from 'fastify';
import { parse } from '../../lib/http';
import type { SettingsService } from './settings.service';

export function settingsRoutes(service: SettingsService): FastifyPluginAsync {
  return async (app) => {
    app.get('/v1/me/settings', async (request): Promise<UserSettings> =>
      service.get(request.userId, parse(LanguageQuerySchema, request.query).language),
    );

    app.patch('/v1/me/settings', async (request): Promise<UserSettings> =>
      service.update(
        request.userId,
        parse(UpdateUserSettingsSchema, request.body),
        parse(LanguageQuerySchema, request.query).language,
      ),
    );
  };
}
