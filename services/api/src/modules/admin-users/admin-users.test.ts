import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryAdminRepository } from '../admin';
import { createInMemoryBillingRepository, type BillingRepository } from '../billing';
import { createInMemoryUsageRepository, type InMemoryPlanRows } from '../usage';
import { createInMemoryAdminUsersRepository, type InMemoryAdminUser } from './index';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const OWNER = uuid(1);
const ALICE = uuid(2);
const BOB = uuid(3);
const CAROL = uuid(4);
const DAVE = uuid(5);
const NOW = new Date('2026-11-15T05:00:00Z');
const DAY = 86_400_000;
const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY);
const in_ = (days: number) => new Date(NOW.getTime() + days * DAY);
const as = (user: string) => ({ [TEST_USER_HEADER]: user });

const PEOPLE: InMemoryAdminUser[] = [
  { id: OWNER, email: 'owner@example.com', name: 'Owner', createdAt: at(60) },
  {
    id: ALICE,
    email: 'Alice@Example.com',
    name: 'Alice Nguyen',
    createdAt: at(2),
    translationMs: 3_600_000,
    lastActiveAt: at(1),
  },
  { id: BOB, email: 'bob@example.com', name: 'Bob Tran', createdAt: at(10) },
  { id: CAROL, email: 'carol@example.com', name: 'Carol Le', createdAt: at(20) },
  { id: DAVE, email: 'dave@example.com', name: 'Dave Pham', createdAt: at(30) },
];
const EMAILS = Object.fromEntries(PEOPLE.map((p) => [p.id, p.email]));

describe('admin users', () => {
  let app: FastifyInstance;
  let plans: InMemoryPlanRows;
  let billing: BillingRepository;
  let logs = '';
  afterEach(() => app.close());

  async function build(
    options: {
      people?: InMemoryAdminUser[];
      paid?: { amount: number; paidAt: Date }[];
      now?: () => Date;
    } = {},
  ) {
    logs = '';
    plans = new Map();
    plans.set(ALICE, { plan: 'pro', expiresAt: in_(3), source: 'payment' });
    plans.set(BOB, { plan: 'ultra', expiresAt: null, source: 'manual' });
    // Carol paid once and her plan has ended since: she counts as free, with the old end date on show.
    plans.set(CAROL, { plan: 'pro', expiresAt: at(1), source: 'payment' });
    const now = options.now ?? (() => NOW);
    billing = createInMemoryBillingRepository(plans, now);
    app = await buildTestApp({
      adminEmails: ['owner@example.com'],
      logger: {
        level: 'info',
        stream: new Writable({
          write(chunk, _encoding, callback) {
            logs += chunk.toString();
            callback();
          },
        }),
      },
      now,
      repos: {
        admin: createInMemoryAdminRepository(EMAILS),
        usage: createInMemoryUsageRepository(EMAILS, plans),
        billing,
        adminUsers: createInMemoryAdminUsersRepository(
          options.people ?? PEOPLE,
          plans,
          options.paid,
        ),
      },
    });
  }
  const get = (user: string, url: string) => app.inject({ method: 'GET', url, headers: as(user) });
  const put = (user: string, url: string, payload: object) =>
    app.inject({ method: 'PUT', url, headers: as(user), payload });

  describe('forbidden (AC7)', () => {
    it('answers 403 on all four routes to a caller who is not an admin, before looking at the input', async () => {
      await build();
      const missing = uuid(99);
      for (const res of [
        await get(ALICE, '/v1/admin/dashboard'),
        await get(ALICE, '/v1/admin/users'),
        await get(ALICE, '/v1/admin/users?cursor=garbage&limit=1'),
        await get(ALICE, `/v1/admin/users/${missing}`),
        await get(ALICE, '/v1/admin/users/not-a-uuid'),
        await put(ALICE, `/v1/admin/users/${missing}/plan`, { plan: 'ultra' }),
        await put(ALICE, `/v1/admin/users/${BOB}/plan`, { nonsense: true }),
      ]) {
        expect(res.statusCode).toBe(403);
      }
      expect(plans.get(BOB)?.plan).toBe('ultra');
      expect(plans.has(DAVE)).toBe(false);
    });

    it('answers 401 without a session', async () => {
      await build();
      expect((await app.inject({ method: 'GET', url: '/v1/admin/users' })).statusCode).toBe(401);
      expect(
        (await app.inject({ method: 'PUT', url: `/v1/admin/users/${ALICE}/plan`, payload: {} }))
          .statusCode,
      ).toBe(401);
    });
  });

  describe('dashboard (AC1)', () => {
    it('counts plans in force, new sign-ups, expiring plans and this month revenue', async () => {
      await build({
        paid: [
          { amount: 99_000, paidAt: at(1) },
          { amount: 249_000, paidAt: new Date('2026-10-31T17:00:00Z') }, // 00:00 on 1 Nov in Vietnam
          { amount: 990_000, paidAt: new Date('2026-10-31T16:30:00Z') }, // 23:30 on 31 Oct in Vietnam
        ],
      });
      const res = await get(OWNER, '/v1/admin/dashboard');
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        generatedAt: NOW.toISOString(),
        totalUsers: 5,
        // Carol's Pro has ended; Owner and Dave never had a plan.
        byPlan: { free: 3, pro: 1, ultra: 1 },
        newUsers7d: 1,
        revenueThisMonth: 348_000,
        // Alice ends in 3 days. Bob has no end date. Carol's ended yesterday.
        expiringIn7d: 1,
      });
    });

    it('does not count a hand-set plan as revenue', async () => {
      await build({ paid: [] });
      expect((await get(OWNER, '/v1/admin/dashboard')).json().revenueThisMonth).toBe(0);
    });
  });

  describe('list (AC2)', () => {
    it('shows every column, newest sign-up first', async () => {
      await build();
      const res = await get(OWNER, '/v1/admin/users');
      expect(res.statusCode).toBe(200);
      const { items, nextCursor } = res.json();
      expect(nextCursor).toBeNull();
      expect(items.map((i: { id: string }) => i.id)).toEqual([ALICE, BOB, CAROL, DAVE, OWNER]);
      expect(items[0]).toEqual({
        id: ALICE,
        email: 'Alice@Example.com',
        name: 'Alice Nguyen',
        createdAt: at(2).toISOString(),
        plan: 'pro',
        source: 'payment',
        expiresAt: in_(3).toISOString(),
        translationMsThisMonth: 3_600_000,
        lastActiveAt: at(1).toISOString(),
      });
      expect(items[1]).toMatchObject({ plan: 'ultra', source: 'manual', expiresAt: null });
      // Ended plan: free now, with the old end date and source still on the row.
      expect(items[2]).toMatchObject({
        plan: 'free',
        source: 'payment',
        expiresAt: at(1).toISOString(),
      });
      expect(items[3]).toMatchObject({
        plan: 'free',
        source: null,
        expiresAt: null,
        lastActiveAt: null,
      });
    });

    it('pages 50 at a time without repeating a row, and refuses a broken cursor', async () => {
      const many: InMemoryAdminUser[] = Array.from({ length: 120 }, (_, i) => ({
        id: uuid(1000 + i),
        email: `user${i}@example.com`,
        name: `User ${i}`,
        // Pairs share a timestamp, so the id tie-break is exercised.
        createdAt: new Date(NOW.getTime() - Math.floor(i / 2) * 1000),
      }));
      await build({ people: [{ ...PEOPLE[0]!, createdAt: at(900) }, ...many] });
      const first = (await get(OWNER, '/v1/admin/users')).json();
      expect(first.items).toHaveLength(50);
      expect(first.nextCursor).toEqual(expect.any(String));
      const second = (
        await get(OWNER, `/v1/admin/users?cursor=${encodeURIComponent(first.nextCursor)}`)
      ).json();
      const third = (
        await get(OWNER, `/v1/admin/users?cursor=${encodeURIComponent(second.nextCursor)}`)
      ).json();
      expect(second.items).toHaveLength(50);
      expect(third.items).toHaveLength(21);
      expect(third.nextCursor).toBeNull();
      const ids = [...first.items, ...second.items, ...third.items].map(
        (i: { id: string }) => i.id,
      );
      expect(new Set(ids).size).toBe(121);

      for (const cursor of [
        'garbage',
        Buffer.from('{"createdAt":"x","id":"y"}').toString('base64url'),
      ]) {
        expect((await get(OWNER, `/v1/admin/users?cursor=${cursor}`)).statusCode).toBe(400);
      }
    });
  });

  describe('search and filter (AC3)', () => {
    it('matches email or name, ignoring case', async () => {
      await build();
      const find = async (q: string) =>
        (await get(OWNER, `/v1/admin/users?q=${encodeURIComponent(q)}`))
          .json()
          .items.map((i: { id: string }) => i.id);
      expect(await find('ALICE@exam')).toEqual([ALICE]);
      expect(await find('tran')).toEqual([BOB]);
      expect(await find('%')).toEqual([]);
      expect(await find('nobody')).toEqual([]);
      expect((await get(OWNER, `/v1/admin/users?q=${'x'.repeat(101)}`)).statusCode).toBe(400);
    });

    it('filters by the plan in force, so Free includes people with no plan and with an ended one', async () => {
      await build();
      const ids = async (query: string) =>
        (await get(OWNER, `/v1/admin/users?${query}`))
          .json()
          .items.map((i: { id: string }) => i.id);
      expect(await ids('plan=free')).toEqual([CAROL, DAVE, OWNER]);
      expect(await ids('plan=pro')).toEqual([ALICE]);
      expect(await ids('plan=ultra')).toEqual([BOB]);
      expect(await ids('expiring=1')).toEqual([ALICE]);
      expect(await ids('plan=free&expiring=1')).toEqual([]);
      expect((await get(OWNER, '/v1/admin/users?plan=gold')).statusCode).toBe(400);
    });
  });

  describe('detail (AC4)', () => {
    it('shows plan, the same usage as /v1/me/usage, and only that person orders without payment links', async () => {
      await build();
      const offer = {
        provider: 'fake',
        plan: 'pro',
        period: 'month',
        amount: 99_000,
        expiresAt: in_(1),
      } as const;
      const mine = await billing.createOrder(ALICE, offer);
      await billing.attachCheckout(ALICE, mine.id, {
        linkId: 'link-1',
        qrCode: '000201-secret-qr',
        checkoutUrl: 'https://pay.example/checkout/1',
      });
      await billing.createOrder(BOB, { ...offer, plan: 'ultra', amount: 249_000 });
      const own = await get(ALICE, '/v1/me/usage');
      const res = await get(OWNER, `/v1/admin/users/${ALICE}`);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.usage).toEqual(own.json());
      expect(body.user).toMatchObject({ id: ALICE, plan: 'pro', source: 'payment' });
      expect(body.orders).toEqual([
        {
          id: mine.id,
          plan: 'pro',
          period: 'month',
          amount: 99_000,
          status: 'pending',
          createdAt: expect.any(String),
          paidAt: null,
          planExpiresAt: null,
        },
      ]);
      expect(res.body).not.toContain('secret-qr');
      expect(res.body).not.toContain('pay.example');
      expect(Object.keys(body).sort()).toEqual(['orders', 'usage', 'user']);
    });

    it('does not show meeting content: the detail has no field for it', async () => {
      await build();
      const body = (await get(OWNER, `/v1/admin/users/${ALICE}`)).json();
      expect(Object.keys(body.user).sort()).toEqual([
        'createdAt',
        'email',
        'expiresAt',
        'id',
        'lastActiveAt',
        'name',
        'plan',
        'source',
        'translationMsThisMonth',
      ]);
    });

    it('answers 404 for an id nobody has', async () => {
      await build();
      expect((await get(OWNER, `/v1/admin/users/${uuid(99)}`)).statusCode).toBe(404);
      expect((await get(OWNER, '/v1/admin/users/not-a-uuid')).statusCode).toBe(400);
    });
  });

  describe('change plan (AC5)', () => {
    it('stores a hand-set plan, and the next quota check uses it', async () => {
      await build();
      const before = (await get(DAVE, '/v1/me/usage')).json();
      expect(before.plan).toBe('free');
      const res = await put(OWNER, `/v1/admin/users/${DAVE}/plan`, {
        plan: 'pro',
        expiresAt: in_(30).toISOString(),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        plan: 'pro',
        source: 'manual',
        expiresAt: in_(30).toISOString(),
      });
      expect(plans.get(DAVE)).toMatchObject({ plan: 'pro', source: 'manual' });
      const after = (await get(DAVE, '/v1/me/usage')).json();
      expect(after.plan).toBe('pro');
      expect(after.usage.debriefs.limit).toBeNull();
      // The list reflects it too.
      const row = (await get(OWNER, `/v1/admin/users/${DAVE}`)).json().user;
      expect(row).toMatchObject({ plan: 'pro', source: 'manual' });
    });

    it('drops the end date for Free, and refuses a past date, an unknown id and a user id in the body', async () => {
      await build();
      const free = await put(OWNER, `/v1/admin/users/${ALICE}/plan`, {
        plan: 'free',
        expiresAt: in_(5).toISOString(),
      });
      expect(free.json()).toEqual({ plan: 'free', source: 'manual', expiresAt: null });
      expect(
        (
          await put(OWNER, `/v1/admin/users/${BOB}/plan`, {
            plan: 'pro',
            expiresAt: at(1).toISOString(),
          })
        ).statusCode,
      ).toBe(400);
      expect(plans.get(BOB)?.plan).toBe('ultra');
      expect(
        (await put(OWNER, `/v1/admin/users/${uuid(99)}/plan`, { plan: 'pro' })).statusCode,
      ).toBe(404);
      expect(
        (await put(OWNER, `/v1/admin/users/${BOB}/plan`, { plan: 'pro', userId: DAVE })).statusCode,
      ).toBe(400);
      expect((await put(OWNER, `/v1/admin/users/${BOB}/plan`, { plan: 'gold' })).statusCode).toBe(
        400,
      );
    });
  });

  describe('audit log (AC8)', () => {
    it('records admin, person, old and new plan, and no email', async () => {
      await build();
      await put(OWNER, `/v1/admin/users/${ALICE}/plan`, {
        plan: 'ultra',
        expiresAt: in_(60).toISOString(),
      });
      const entry = logs
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>)
        .find((e) => e.msg === 'plan changed');
      expect(entry).toMatchObject({
        adminId: OWNER,
        targetUserId: ALICE,
        from: { plan: 'pro', source: 'payment', expiresAt: in_(3).toISOString() },
        to: { plan: 'ultra', expiresAt: in_(60).toISOString() },
      });
      expect(logs).not.toContain('example.com');
    });

    it('changes nothing on the read routes', async () => {
      await build();
      const snapshot = JSON.stringify([...plans]);
      await get(OWNER, '/v1/admin/dashboard');
      await get(OWNER, '/v1/admin/users');
      await get(OWNER, `/v1/admin/users/${ALICE}`);
      expect(JSON.stringify([...plans])).toBe(snapshot);
      expect(logs).not.toContain('plan changed');
    });
  });
});
