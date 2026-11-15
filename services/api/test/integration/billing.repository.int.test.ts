import postgres from 'postgres';
import { DEFAULT_PLAN_PRICES } from '@cuelingo/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../src/testing';
import { createFakeProvider, createPostgresBillingRepository } from '../../src/modules/billing';
import { createPostgresUsageRepository } from '../../src/modules/usage';
import { startMigratedPostgres, type TestDatabase } from './postgres';

/** Webhooks race in production (PayOS retries, the poll fallback): the period must be added once. */
describe('billing on real Postgres', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  const newUser = async (email: string) =>
    (
      await sql<
        { id: string }[]
      >`INSERT INTO auth_user (name, email) VALUES (${email}, ${email}) RETURNING id`
    )[0]!.id;
  const now = new Date('2026-11-15T03:00:00Z');
  const open = (userId: string, plan: 'pro' | 'ultra' = 'pro') =>
    createPostgresBillingRepository(sql).createOrder(userId, {
      provider: 'fake',
      plan,
      period: 'month',
      amount: DEFAULT_PLAN_PRICES[plan].month,
      expiresAt: new Date('2026-11-15T03:15:00Z'),
    });

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
  });
  afterAll(async () => {
    await sql.end();
    await db.stop();
  });

  it('gives unique order codes from the sequence and scopes reads by user', async () => {
    const repo = createPostgresBillingRepository(sql);
    const alice = await newUser('alice@example.com');
    const bob = await newUser('bob@example.com');
    const a = await open(alice);
    const b = await open(alice);
    expect(a.orderCode).toBeGreaterThanOrEqual(1_000_000);
    expect(b.orderCode).toBe(a.orderCode + 1);
    expect(await repo.getForUser(bob, a.id)).toBeNull();
    expect(
      await repo.attachCheckout(bob, a.id, { linkId: 'x', qrCode: 'q', checkoutUrl: 'u' }),
    ).toBeNull();
    expect(await repo.listForUser(bob, 10)).toEqual([]);
    expect((await repo.listForUser(alice, 10)).map((o) => o.id)).toEqual([b.id, a.id]);
  });

  it('applies five parallel settlements of one order once (AC3)', async () => {
    const repo = createPostgresBillingRepository(sql);
    const user = await newUser('parallel@example.com');
    const order = await open(user);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        repo.settle(order.orderCode, { paidAt: now, now, prices: DEFAULT_PLAN_PRICES }),
      ),
    );
    expect(results.filter((r) => r?.settled)).toHaveLength(1);
    const [plan] =
      await sql`SELECT plan, source, expires_at FROM user_plans WHERE user_id = ${user}`;
    expect(plan).toMatchObject({ plan: 'pro', source: 'payment' });
    expect(plan!.expires_at.toISOString()).toBe('2026-12-15T03:00:00.000Z');
    const [row] =
      await sql`SELECT status, paid_at, plan_expires_at FROM billing_orders WHERE id = ${order.id}`;
    expect(row).toMatchObject({ status: 'paid' });
    expect(row!.plan_expires_at.toISOString()).toBe('2026-12-15T03:00:00.000Z');
  });

  it('serialises two different orders of one new user: both periods count', async () => {
    const repo = createPostgresBillingRepository(sql);
    const user = await newUser('two-orders@example.com');
    const [one, two] = [await open(user), await open(user)];
    await Promise.all([
      repo.settle(one.orderCode, { paidAt: now, now, prices: DEFAULT_PLAN_PRICES }),
      repo.settle(two.orderCode, { paidAt: now, now, prices: DEFAULT_PLAN_PRICES }),
    ]);
    const [plan] = await sql`SELECT expires_at FROM user_plans WHERE user_id = ${user}`;
    expect(plan!.expires_at.toISOString()).toBe('2027-01-15T03:00:00.000Z');
  });

  it('settles an order that was marked expired, and refuses a cancelled one', async () => {
    const repo = createPostgresBillingRepository(sql);
    const user = await newUser('expired@example.com');
    const late = await open(user);
    await repo.closePending(late.id, 'expired');
    expect(
      (await repo.settle(late.orderCode, { paidAt: now, now, prices: DEFAULT_PLAN_PRICES }))
        ?.settled,
    ).toBe(true);
    const cancelled = await open(user);
    await repo.closePending(cancelled.id, 'cancelled');
    expect(
      (await repo.settle(cancelled.orderCode, { paidAt: now, now, prices: DEFAULT_PLAN_PRICES }))
        ?.settled,
    ).toBe(false);
    expect(await repo.settle(42, { paidAt: now, now, prices: DEFAULT_PLAN_PRICES })).toBeNull();
  });

  it('refuses a duplicate provider link id', async () => {
    const repo = createPostgresBillingRepository(sql);
    const user = await newUser('link@example.com');
    const [a, b] = [await open(user), await open(user)];
    await repo.attachCheckout(user, a.id, { linkId: 'same', qrCode: 'q', checkoutUrl: 'u' });
    await expect(
      repo.attachCheckout(user, b.id, { linkId: 'same', qrCode: 'q', checkoutUrl: 'u' }),
    ).rejects.toThrow();
  });

  it('removes orders together with the account', async () => {
    const user = await newUser('gone@example.com');
    await open(user);
    await sql`DELETE FROM auth_user WHERE id = ${user}`;
    expect(await sql`SELECT 1 FROM billing_orders WHERE user_id = ${user}`).toHaveLength(0);
  });

  it('upgrades the plan through the HTTP webhook with five parallel deliveries', async () => {
    const fake = createFakeProvider();
    const user = await newUser('http@example.com');
    const app = await buildTestApp({
      repos: {
        usage: createPostgresUsageRepository(sql),
        billing: createPostgresBillingRepository(sql),
      },
      paymentProvider: fake,
    });
    try {
      const headers = { [TEST_USER_HEADER]: user };
      const created = await app.inject({
        method: 'POST',
        url: '/v1/billing/orders',
        headers,
        payload: { plan: 'pro', period: 'month' },
      });
      expect(created.statusCode).toBe(201);
      const order = created.json();
      const body = fake.webhook({
        orderCode: Number(order.transferContent.slice(2)),
        amount: order.amount,
      });
      const replies = await Promise.all(
        Array.from({ length: 5 }, () =>
          app.inject({ method: 'POST', url: '/v1/billing/webhook/payos', payload: body as object }),
        ),
      );
      expect(replies.every((r) => r.statusCode === 200)).toBe(true);
      const usage = await app.inject({ method: 'GET', url: '/v1/me/usage', headers });
      expect(usage.json().plan).toBe('pro');
      const overview = (await app.inject({ method: 'GET', url: '/v1/billing', headers })).json();
      // The period was added once: about one month from now, not five.
      const days = (new Date(overview.current.expiresAt).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(27);
      expect(days).toBeLessThan(32);
    } finally {
      await app.close();
    }
  });
});
