import { createAiGateway, type AiCallRecord } from '@cuelingo/ai-gateway';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createSql } from './lib/db';
import { createPgBossQueue } from './lib/queue';
import { createAuthModule } from './modules/auth';
import { createPostgresGlossaryRepository } from './modules/glossary';

const config = loadConfig();

const sql = createSql(config.DATABASE_URL);
const queue = await createPgBossQueue(config.DATABASE_URL);
const authModule = createAuthModule(config);
const glossaryRepository = createPostgresGlossaryRepository(sql);

const gateway = config.GEMINI_API_KEY
  ? createAiGateway({
      googleApiKey: config.GEMINI_API_KEY,
      onCall: logAiCall,
    })
  : undefined;

async function verifyToken(token: string): Promise<string | null> {
  if (!config.REALTIME_DEV_TOKEN || token !== config.REALTIME_DEV_TOKEN) return null;
  if (config.REALTIME_DEV_USER_ID) return config.REALTIME_DEV_USER_ID;
  const [profile] = await sql<{ user_id: string }[]>`
    SELECT user_id FROM learner_profiles ORDER BY created_at LIMIT 1`;
  return profile?.user_id ?? null;
}

const realtime = gateway
  ? {
      gateway,
      verifyToken,
      async glossary(userId: string) {
        return (await glossaryRepository.list(userId))
          .slice(0, 50)
          .map(({ term, translation }) => ({ term, translation }));
      },
    }
  : undefined;

const app = await buildApp({
  repos: { glossary: glossaryRepository },
  queue,
  resolveUserId: authModule.resolveUserId,
  authRoutes: authModule.routes,
  webOrigin: config.WEB_ORIGIN,
  realtime,
  assist: gateway ? { gateway } : undefined,
  verifyDevToken: config.NODE_ENV === 'production' ? undefined : verifyToken,
  logger: true,
});

function logAiCall({ task, model, latencyMs }: AiCallRecord): void {
  app.log.info({ task, model, latencyMs }, 'AI call completed');
}

if (!gateway) app.log.warn('Realtime and Quick Assist disabled because GEMINI_API_KEY is not set');

const shutdown = async () => {
  await app.close();
  await queue.stop();
  await authModule.close();
  await sql.end();
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: config.PORT, host: '0.0.0.0' });
