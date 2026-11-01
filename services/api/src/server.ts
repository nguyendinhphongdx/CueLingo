import { buildApp } from './app';
import { loadConfig } from './config';
import { createSql } from './lib/db';
import { createPostgresGlossaryRepository } from './modules/glossary';

const config = loadConfig();

const sql = createSql(config.DATABASE_URL);
const app = await buildApp({
  repos: { glossary: createPostgresGlossaryRepository(sql) },
  // TEMPORARY until Better Auth lands in this same task (header auth for local runs only).
  allowDevAuth: config.NODE_ENV !== 'production',
  logger: true,
});

await app.listen({ port: config.PORT, host: '0.0.0.0' });
