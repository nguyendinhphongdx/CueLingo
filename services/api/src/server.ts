import { createAiGateway, type AiCallRecord } from '@cuelingo/ai-gateway';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createSql } from './lib/db';
import { createPgBossQueue } from './lib/queue';
import { createAuthModule } from './modules/auth';
import { createPostgresDebriefRepository } from './modules/debrief';
import { createPostgresEventsRepository } from './modules/events';
import { createPostgresGlossaryRepository } from './modules/glossary';
import { createPostgresPrivacyRepository } from './modules/privacy';
import { createPostgresSessionsRepository } from './modules/sessions';
import { createPostgresSettingsRepository } from './modules/settings';
import { createPostgresAccountRepository } from './modules/account';
import { createDeviceService, createPostgresDeviceRepository } from './modules/device';
import { createPostgresPhrasesRepository, createPostgresStudyRepository } from './modules/review';

const config = loadConfig();

const sql = createSql(config.DATABASE_URL);
const queue = await createPgBossQueue(config.DATABASE_URL);
const authModule = createAuthModule(config);
const debriefRepository = createPostgresDebriefRepository(sql);
const eventsRepository = createPostgresEventsRepository(sql);
const glossaryRepository = createPostgresGlossaryRepository(sql);
const privacyRepository = createPostgresPrivacyRepository(sql);
const sessionsRepository = createPostgresSessionsRepository(sql);
const phrasesRepository = createPostgresPhrasesRepository(sql);
const deviceRepository = createPostgresDeviceRepository(sql);
const deviceService = createDeviceService(deviceRepository);
const studyRepository = createPostgresStudyRepository(sql);

const gateway = config.GEMINI_API_KEY
  ? createAiGateway({
      googleApiKey: config.GEMINI_API_KEY,
      onCall: logAiCall,
    })
  : undefined;

async function verifyDevToken(token: string): Promise<string | null> {
  if (!config.REALTIME_DEV_TOKEN || token !== config.REALTIME_DEV_TOKEN) return null;
  if (config.REALTIME_DEV_USER_ID) return config.REALTIME_DEV_USER_ID;
  const [profile] = await sql<{ user_id: string }[]>`
    SELECT user_id FROM learner_profiles ORDER BY created_at LIMIT 1`;
  return profile?.user_id ?? null;
}

const realtime = gateway
  ? {
      gateway,
      // The live-caption socket authenticates with either a device token (the signed-in app) or the dev token.
      verifyToken: async (token: string) =>
        (await deviceService.verifyToken(token)) ??
        (config.NODE_ENV === 'production' ? null : await verifyDevToken(token)),
      async glossary(userId: string) {
        return (await glossaryRepository.list(userId))
          .slice(0, 50)
          .map(({ term, translation }) => ({ term, translation }));
      },
      store: sessionsRepository,
    }
  : undefined;

const app = await buildApp({
  repos: {
    debrief: debriefRepository,
    events: eventsRepository,
    glossary: glossaryRepository,
    privacy: privacyRepository,
    sessions: sessionsRepository,
    settings: createPostgresSettingsRepository(sql),
    account: createPostgresAccountRepository(sql),
    device: deviceRepository,
    phrases: phrasesRepository,
    study: studyRepository,
  },
  queue,
  resolveUserId: authModule.resolveUserId,
  authRoutes: authModule.routes,
  webOrigin: config.WEB_ORIGIN,
  realtime,
  assist: gateway ? { gateway } : undefined,
  verifyDevToken: config.NODE_ENV === 'production' ? undefined : verifyDevToken,
  logger: true,
});

function logAiCall({ task, model, latencyMs }: AiCallRecord): void {
  app.log.info({ task, model, latencyMs }, 'AI call completed');
}

if (!gateway) app.log.warn('Realtime and Quick Assist disabled because GEMINI_API_KEY is not set');

// Ctrl+C reaches the process as SIGINT and again as SIGTERM from the package manager: close everything once.
let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await app.close();
  await queue.stop();
  await authModule.close();
  await sql.end();
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: config.PORT, host: '0.0.0.0' });
