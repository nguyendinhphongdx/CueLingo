import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryAdminRepository } from '../admin';
import {
  createInMemoryInvitesRepository,
  createInviteGate,
  generateInviteCode,
  hashInviteCode,
  inviteCodeFromCookie,
} from './index';

const ADMIN = 'admin-user';
const TESTER = 'tester-user';

describe('invites module', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let repo: ReturnType<typeof createInMemoryInvitesRepository>;

  beforeEach(async () => {
    repo = createInMemoryInvitesRepository();
    app = await buildTestApp({
      repos: {
        invites: repo,
        admin: createInMemoryAdminRepository({
          [ADMIN]: 'owner@example.com',
          [TESTER]: 'tester@example.com',
        }),
      },
      adminEmails: ['owner@example.com'],
    });
  });
  afterEach(() => app.close());

  const as = (user: string) => ({ [TEST_USER_HEADER]: user });
  const create = (user: string, payload: object = {}) =>
    app.inject({ method: 'POST', url: '/v1/admin/invites', headers: as(user), payload });
  const intent = (code: unknown, ip = '10.0.0.1') =>
    app.inject({
      method: 'POST',
      url: '/v1/invites/intent',
      remoteAddress: ip,
      payload: { code },
    });

  // AC4
  it('creates a code once, stores only its hash and lists it without the code', async () => {
    const res = await create(ADMIN);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/);
    expect(body).toMatchObject({ maxUses: 1, usedCount: 0, note: null });
    const days = (Date.parse(body.expiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);

    expect(await repo.consume(hashInviteCode(body.code), new Date())).toBe(body.id);

    const list = await app.inject({ method: 'GET', url: '/v1/admin/invites', headers: as(ADMIN) });
    expect(list.statusCode).toBe(200);
    expect(list.body).not.toContain(body.code);
    expect(list.json().items[0]).toMatchObject({ id: body.id, usedCount: 1 });
  });

  it('lets the admin choose uses, days and a note', async () => {
    const res = await create(ADMIN, { maxUses: 5, expiresInDays: 7, note: 'nhóm kế toán' });
    expect(res.json()).toMatchObject({ maxUses: 5, note: 'nhóm kế toán' });
  });

  it('refuses everyone who is not on the admin allowlist', async () => {
    expect((await create(TESTER)).statusCode).toBe(403);
    const list = await app.inject({ method: 'GET', url: '/v1/admin/invites', headers: as(TESTER) });
    expect(list.statusCode).toBe(403);
    const anonymous = await app.inject({ method: 'GET', url: '/v1/admin/invites' });
    expect(anonymous.statusCode).toBe(401);
  });

  it('revokes a code so it stops working', async () => {
    const made = (await create(ADMIN)).json();
    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/invites/${made.id}`,
      headers: as(ADMIN),
    });
    expect(del.statusCode).toBe(204);
    expect((await intent(made.code)).statusCode).toBe(400);
    const again = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/invites/${made.id}`,
      headers: as(ADMIN),
    });
    expect(again.statusCode).toBe(404);
  });

  // AC2
  it('answers every refusal with the same message and no cookie', async () => {
    const used = (await create(ADMIN)).json();
    await repo.consume(hashInviteCode(used.code), new Date());
    const revoked = (await create(ADMIN)).json();
    await repo.revoke(revoked.id);

    const refusals = await Promise.all(
      [generateInviteCode(), used.code, revoked.code, 'short', '', 42].map((code) => intent(code)),
    );
    for (const res of refusals) {
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatchObject({
        code: 'INVITE_INVALID',
        message: 'Mã mời không dùng được',
      });
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('refuses an expired code', async () => {
    const hash = hashInviteCode('EXPIREDCODE0');
    await repo.create({
      codeHash: hash,
      maxUses: 1,
      note: null,
      expiresAt: new Date(Date.now() - 1000),
      createdBy: null,
    });
    expect((await intent('EXPIREDCODE0')).statusCode).toBe(400);
  });

  it('sets a short-lived httpOnly cookie for a good code, in any typing style', async () => {
    const made = (await create(ADMIN)).json();
    const typed = `${made.code.slice(0, 4)}-${made.code.slice(4, 8).toLowerCase()} ${made.code.slice(8)}`;
    const res = await intent(typed);
    expect(res.statusCode).toBe(204);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain(`cl_invite=${made.code}`);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Max-Age=1800/);
    expect(cookie).not.toMatch(/Secure/);
    // Checking a code does not use it up.
    expect((await intent(made.code)).statusCode).toBe(204);
  });

  it('limits attempts per address', async () => {
    for (let i = 0; i < 10; i++) await intent('WRONGCODE000', '10.9.9.9');
    const blocked = await intent('WRONGCODE000', '10.9.9.9');
    expect(blocked.statusCode).toBe(429);
    expect((await intent('WRONGCODE000', '10.9.9.8')).statusCode).toBe(400);
  });

  it('rejects an unknown field in the request body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/invites/intent',
      payload: { code: 'ABCDEFGHJKMN', admin: true },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('invite gate', () => {
  it('lets exactly one of two people take the last use', async () => {
    const repo = createInMemoryInvitesRepository();
    const code = generateInviteCode();
    await repo.create({
      codeHash: hashInviteCode(code),
      maxUses: 1,
      note: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdBy: null,
    });
    const gate = createInviteGate(repo, true);
    const results = await Promise.all([gate.redeem(code), gate.redeem(code)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('refuses when there is no code at all', async () => {
    const gate = createInviteGate(createInMemoryInvitesRepository(), true);
    expect(await gate.redeem(undefined)).toBeNull();
  });

  it('reads the code out of a Cookie header', () => {
    expect(inviteCodeFromCookie('a=1; cl_invite=ABCDEFGHJKMN; b=2')).toBe('ABCDEFGHJKMN');
    expect(inviteCodeFromCookie('a=1')).toBeUndefined();
    expect(inviteCodeFromCookie(null)).toBeUndefined();
  });
});
