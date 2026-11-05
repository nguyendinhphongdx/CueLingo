import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { loadConfig } from '../../src/config';
import { createInMemoryQueue } from '../../src/lib/queue';
import { createAuthModule, type Mailer } from '../../src/modules/auth';
import { createPostgresAccountRepository } from '../../src/modules/account';
import { createPostgresAdminRepository } from '../../src/modules/admin';
import { createInMemoryDebriefRepository } from '../../src/modules/debrief';
import { createPostgresDeviceRepository } from '../../src/modules/device';
import { createPostgresDialRepository } from '../../src/modules/dial';
import { createPostgresEventsRepository } from '../../src/modules/events';
import { createPostgresConversationsRepository } from '../../src/modules/conversations';
import { createPostgresGlossaryRepository } from '../../src/modules/glossary';
import {
  createInviteGate,
  createPostgresInvitesRepository,
  generateInviteCode,
  hashInviteCode,
} from '../../src/modules/invites';
import { createPostgresFeedbackRepository } from '../../src/modules/feedback';
import { createPostgresPlacementRepository } from '../../src/modules/placement';
import { createPostgresPrivacyRepository } from '../../src/modules/privacy';
import {
  createPostgresPhrasesRepository,
  createPostgresStudyRepository,
} from '../../src/modules/review';
import { createPostgresSessionsRepository } from '../../src/modules/sessions';
import { createPostgresSettingsRepository } from '../../src/modules/settings';
import { createPostgresSpeakersRepository } from '../../src/modules/speakers';
import { startMigratedPostgres, type TestDatabase } from './postgres';

const ORIGIN = 'http://localhost:3000';

/** AC1-AC5: with INVITES_REQUIRED, only a valid code creates an account, whatever way the person signs in. */
describe('invite codes on real Postgres (AC1-AC5)', () => {
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

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    const config = loadConfig({
      DATABASE_URL: db.url,
      BETTER_AUTH_SECRET: 'integration-test-secret-integration-test',
      BETTER_AUTH_URL: 'http://localhost:4000',
      WEB_ORIGIN: ORIGIN,
      INVITES_REQUIRED: 'true',
      NODE_ENV: 'test',
    });
    const invites = createPostgresInvitesRepository(sql);
    authModule = createAuthModule(config, mailer, createInviteGate(invites, true));
    app = await buildApp({
      repos: {
        debrief: createInMemoryDebriefRepository(),
        events: createPostgresEventsRepository(sql),
        glossary: createPostgresGlossaryRepository(sql),
        conversations: createPostgresConversationsRepository(sql),
        privacy: createPostgresPrivacyRepository(sql),
        sessions: createPostgresSessionsRepository(sql),
        speakers: createPostgresSpeakersRepository(sql),
        account: createPostgresAccountRepository(sql),
        dial: createPostgresDialRepository(sql),
        placement: createPostgresPlacementRepository(sql),
        device: createPostgresDeviceRepository(sql),
        phrases: createPostgresPhrasesRepository(sql),
        study: createPostgresStudyRepository(sql),
        admin: createPostgresAdminRepository(sql),
        settings: createPostgresSettingsRepository(sql),
        invites,
        feedback: createPostgresFeedbackRepository(sql),
      },
      queue: createInMemoryQueue(),
      resolveUserId: authModule.resolveUserId,
      authRoutes: authModule.routes,
      webOrigin: ORIGIN,
      adminEmails: ['owner@example.com'],
    });
  });
  afterAll(async () => {
    await app.close();
    await authModule.close();
    await sql.end();
    await db.stop();
  });

  const seedInvite = async (maxUses = 1, expiresAt = new Date(Date.now() + 86_400_000)) => {
    const code = generateInviteCode();
    await createPostgresInvitesRepository(sql).create({
      codeHash: hashInviteCode(code),
      maxUses,
      note: null,
      expiresAt,
      createdBy: null,
    });
    return code;
  };

  /** Asks for a link, then opens it the way a browser would: with the cookies it holds. */
  const signInWithMagicLink = async (email: string, inviteCookie?: string) => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/magic-link',
      headers: { origin: ORIGIN },
      payload: {
        email,
        callbackURL: `${ORIGIN}/app`,
        errorCallbackURL: `${ORIGIN}/login`,
        newUserCallbackURL: `${ORIGIN}/app`,
      },
    });
    const link = new URL(lastLink!);
    return app.inject({
      method: 'GET',
      url: `${link.pathname}${link.search}`,
      headers: { origin: ORIGIN, ...(inviteCookie ? { cookie: `cl_invite=${inviteCookie}` } : {}) },
    });
  };
  const userCount = async (email: string) => {
    const [row] = await sql<{ count: string }[]>`
      SELECT count(*) FROM auth_user WHERE email = ${email}`;
    return Number(row?.count);
  };
  const usedCount = async (code: string) => {
    const [row] = await sql<{ used_count: number }[]>`
      SELECT used_count FROM invites WHERE code_hash = ${hashInviteCode(code)}`;
    return row?.used_count;
  };

  it('creates the account of a new person who brings a valid code (AC1)', async () => {
    const code = await seedInvite();
    const res = await signInWithMagicLink('new1@example.com', code);
    expect(res.headers.location).not.toMatch(/error=/);
    expect(await userCount('new1@example.com')).toBe(1);
    expect(await usedCount(code)).toBe(1);
    const [redemption] = await sql`SELECT * FROM invite_redemptions`;
    expect(redemption).toBeDefined();
  });

  it.each([
    ['no code', async () => undefined],
    ['a wrong code', async () => generateInviteCode()],
    ['an expired code', async () => seedInvite(1, new Date(Date.now() - 1000))],
    [
      'a revoked code',
      async () => {
        const code = await seedInvite();
        await sql`UPDATE invites SET revoked_at = now() WHERE code_hash = ${hashInviteCode(code)}`;
        return code;
      },
    ],
  ])('refuses a new person with %s and creates no account (AC2)', async (_name, makeCode) => {
    const email = `refused-${Math.random().toString(36).slice(2)}@example.com`;
    const res = await signInWithMagicLink(email, await makeCode());
    expect(res.headers.location).toContain('error=invite_invalid');
    expect(await userCount(email)).toBe(0);
  });

  it('refuses a code that is used up, with the same error (AC2)', async () => {
    const code = await seedInvite(1);
    await signInWithMagicLink('first@example.com', code);
    const res = await signInWithMagicLink('second@example.com', code);
    expect(res.headers.location).toContain('error=invite_invalid');
    expect(await userCount('second@example.com')).toBe(0);
    expect(await usedCount(code)).toBe(1);
  });

  it('lets only one of two people win the last use (AC2)', async () => {
    const code = await seedInvite(1);
    const links: string[] = [];
    for (const email of ['race-a@example.com', 'race-b@example.com']) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/magic-link',
        headers: { origin: ORIGIN },
        payload: { email, errorCallbackURL: `${ORIGIN}/login` },
      });
      links.push(lastLink!);
    }
    await Promise.all(
      links.map((link) => {
        const url = new URL(link);
        return app.inject({
          method: 'GET',
          url: `${url.pathname}${url.search}`,
          headers: { origin: ORIGIN, cookie: `cl_invite=${code}` },
        });
      }),
    );
    expect((await userCount('race-a@example.com')) + (await userCount('race-b@example.com'))).toBe(
      1,
    );
    expect(await usedCount(code)).toBe(1);
  });

  it('does not ask a person who already has an account for a code (AC3)', async () => {
    const res = await signInWithMagicLink('new1@example.com');
    expect(res.headers.location).not.toMatch(/error=/);
    expect(String(res.headers['set-cookie'])).toContain('session_token');
  });

  it('applies the same gate to a Google sign-up as to an email one (AC5)', async () => {
    const validate = authModule.auth.options.user?.validateUserInfo;
    expect(validate).toBeTypeOf('function');
    const code = await seedInvite();
    const ctx = (cookie?: string) =>
      ({ request: new Request('http://x', { headers: cookie ? { cookie } : {} }) }) as never;
    const user = { email: 'google-person@example.com', name: 'G' };
    const google = {
      method: 'oauth',
      action: 'create-user',
      oauth: { providerId: 'google' },
    } as const;
    const email = { method: 'magic-link', action: 'create-user' } as const;

    expect(await validate!({ user, source: google }, ctx())).toEqual({ error: 'invite_invalid' });
    expect(await validate!({ user, source: email }, ctx())).toEqual({ error: 'invite_invalid' });
    expect(await validate!({ user, source: google }, ctx(`cl_invite=${code}`))).toBeUndefined();
    // A returning Google user is not asked again.
    expect(
      await validate!({ user, source: { ...google, action: 'sign-in' } }, ctx()),
    ).toBeUndefined();
  });

  it('shows the plain code once and keeps only its hash in the database (AC4)', async () => {
    await signInWithMagicLink('owner@example.com', await seedInvite());
    const [owner] = await sql<
      { id: string }[]
    >`SELECT id FROM auth_user WHERE email = 'owner@example.com'`;
    expect(owner).toBeDefined();
    const login = await signInWithMagicLink('owner@example.com');
    const cookie = String(login.headers['set-cookie']).split(';')[0]!;
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/invites',
      headers: { cookie, origin: ORIGIN },
      payload: { maxUses: 3, note: 'nhóm thử 1' },
    });
    expect(created.statusCode).toBe(201);
    const { code } = created.json();
    const rows = await sql<{ code_hash: string }[]>`SELECT code_hash FROM invites`;
    expect(rows.map((r) => r.code_hash)).toContain(hashInviteCode(code));
    expect(JSON.stringify(rows)).not.toContain(code);
  });
});
