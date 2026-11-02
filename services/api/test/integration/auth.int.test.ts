import { getMigrations } from 'better-auth/db/migration';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { loadConfig } from '../../src/config';
import { createInMemoryQueue } from '../../src/lib/queue';
import { createAuthModule, type Mailer } from '../../src/modules/auth';
import { createInMemoryDebriefRepository } from '../../src/modules/debrief';
import { createPostgresEventsRepository } from '../../src/modules/events';
import { createPostgresGlossaryRepository } from '../../src/modules/glossary';
import { createPostgresPrivacyRepository } from '../../src/modules/privacy';
import { createPostgresSessionsRepository } from '../../src/modules/sessions';
import {
  createPostgresPhrasesRepository,
  createPostgresStudyRepository,
} from '../../src/modules/review';
import { createPostgresAccountRepository } from '../../src/modules/account';
import { createPostgresDeviceRepository } from '../../src/modules/device';
import { createPostgresAdminRepository } from '../../src/modules/admin';
import { createPostgresSettingsRepository } from '../../src/modules/settings';
import { startMigratedPostgres, type TestDatabase } from './postgres';

/** AC3 + AC4: magic-link sign-in creates a session that the API accepts; no session means 401. */
describe('auth on real Postgres (AC3, AC4)', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let authModule: ReturnType<typeof createAuthModule>;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let lastLink: string | null = null;

  const mailer: Mailer = {
    async sendMagicLink(_email, url) {
      lastLink = url;
    },
  };
  const config = () =>
    loadConfig({
      DATABASE_URL: db.url,
      BETTER_AUTH_SECRET: 'integration-test-secret-integration-test',
      BETTER_AUTH_URL: 'http://localhost:4000',
      WEB_ORIGIN: 'http://localhost:3000',
    });

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    authModule = createAuthModule(config(), mailer);
    app = await buildApp({
      repos: {
        debrief: createInMemoryDebriefRepository(),
        events: createPostgresEventsRepository(sql),
        glossary: createPostgresGlossaryRepository(sql),
        privacy: createPostgresPrivacyRepository(sql),
        sessions: createPostgresSessionsRepository(sql),
        account: createPostgresAccountRepository(sql),
        device: createPostgresDeviceRepository(sql),
        phrases: createPostgresPhrasesRepository(sql),
        study: createPostgresStudyRepository(sql),
        admin: createPostgresAdminRepository(sql),
        settings: createPostgresSettingsRepository(sql),
      },
      queue: createInMemoryQueue(),
      resolveUserId: authModule.resolveUserId,
      authRoutes: authModule.routes,
      webOrigin: 'http://localhost:3000',
    });
  });
  afterAll(async () => {
    await app.close();
    await authModule.close();
    await sql.end();
    await db.stop();
  });

  it('our migrations cover everything Better Auth needs', async () => {
    const plan = await getMigrations(authModule.auth.options);
    expect(plan.toBeCreated).toEqual([]);
    expect(plan.toBeAdded).toEqual([]);
    expect(plan.schemaProblems).toEqual([]);
  });

  it('rejects API calls without a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/glossary' });
    expect(res.statusCode).toBe(401);
  });

  it('signs in with a magic link and serves that user their own data', async () => {
    const send = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/magic-link',
      headers: { origin: 'http://localhost:3000' },
      payload: { email: 'learner@example.com' },
    });
    expect(send.statusCode).toBe(200);
    expect(lastLink).toContain('/api/auth/magic-link/verify');

    const link = new URL(lastLink!);
    const verify = await app.inject({
      method: 'GET',
      url: `${link.pathname}${link.search}`,
      headers: { origin: 'http://localhost:3000' },
    });
    const cookies = verify.headers['set-cookie'];
    const cookie = (Array.isArray(cookies) ? cookies : [cookies])
      .filter(Boolean)
      .map((c) => c!.split(';')[0])
      .join('; ');
    expect(cookie).toContain('session_token');

    const created = await app.inject({
      method: 'POST',
      url: '/v1/glossary',
      headers: { cookie, origin: 'http://localhost:3000' },
      payload: { term: 'Acme' },
    });
    expect(created.statusCode).toBe(201);

    const [row] = await sql<{ count: string }[]>`SELECT count(*) FROM learner_profiles`;
    expect(Number(row?.count)).toBe(1);
  });
});
