import { buildApp } from './app';
import { createSql } from './lib/db';
import { createPostgresGlossaryRepository } from './modules/glossary';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const sql = createSql(databaseUrl);
const app = await buildApp({
  repos: { glossary: createPostgresGlossaryRepository(sql) },
  allowDevAuth: process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH === '1',
  logger: true,
});

await app.listen({ port: Number(process.env.PORT ?? 4000), host: '0.0.0.0' });
