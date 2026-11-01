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

const app = await buildApp({
  repos: { glossary: createPostgresGlossaryRepository(sql) },
  queue,
  resolveUserId: authModule.resolveUserId,
  authRoutes: authModule.routes,
  webOrigin: config.WEB_ORIGIN,
  logger: true,
});

const shutdown = async () => {
  await app.close();
  await queue.stop();
  await sql.end();
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: config.PORT, host: '0.0.0.0' });
