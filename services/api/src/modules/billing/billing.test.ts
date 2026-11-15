import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createFakeProvider, type FakeProvider } from './providers/fake';

const ALICE = 'alice';
const BOB = 'bob';
const as = (user: string) => ({ [TEST_USER_HEADER]: user });
const START = new Date('2026-11-15T03:00:00Z');
const MIN = 60_000;

describe('billing module', () => {
  let app: FastifyInstance;
  let provider: FakeProvider;
  let now: Date;
  let logs: string[];
  afterEach(() => app.close());

  async function build(options: { withProvider?: boolean } = {}) {
    provider = createFakeProvider();
    now = new Date(START);
    logs = [];
    const stream = new Writable({
      write(chunk, _enc, done) {
        logs.push(String(chunk));
        done();
      },
    });
    app = await buildTestApp({
      paymentProvider: options.withProvider === false ? undefined : provider,
      now: () => now,
      logger: { level: 'info', stream },
    });
  }

  const overview = (user: string) =>
    app.inject({ method: 'GET', url: '/v1/billing', headers: as(user) });
  const create = (user: string, payload: unknown) =>
    app.inject({
      method: 'POST',
      url: '/v1/billing/orders',
      headers: as(user),
      payload: payload as object,
    });
  const getOrder = (user: string, id: string) =>
    app.inject({ method: 'GET', url: `/v1/billing/orders/${id}`, headers: as(user) });
  const list = (user: string) =>
    app.inject({ method: 'GET', url: '/v1/billing/orders', headers: as(user) });
  const webhook = (body: unknown) =>
    app.inject({ method: 'POST', url: '/v1/billing/webhook/payos', payload: body as object });
  const usagePlan = async (user: string) =>
    (await app.inject({ method: 'GET', url: '/v1/me/usage', headers: as(user) })).json().plan;
  const codeOf = (order: { transferContent: string }) => Number(order.transferContent.slice(2));

  async function newOrder(user = ALICE, plan = 'pro', period = 'month') {
    const res = await create(user, { plan, period });
    expect(res.statusCode).toBe(201);
    return res.json();
  }
  const pay = (order: { transferContent: string; amount: number }, extra = {}) =>
    webhook(provider.webhook({ orderCode: codeOf(order), amount: order.amount, ...extra }));

  describe('overview', () => {
    it('lists Pro/Ultra x month/year with server prices and limits (AC1)', async () => {
      await build();
      const body = (await overview(ALICE)).json();
      expect(body.enabled).toBe(true);
      expect(body.current).toEqual({ plan: 'free', expiresAt: null, source: null });
      expect(body.offers).toHaveLength(4);
      const proMonth = body.offers.find(
        (o: { plan: string; period: string }) => o.plan === 'pro' && o.period === 'month',
      );
      expect(proMonth).toMatchObject({
        amount: 99_000,
        limits: { debriefs: null, agent_messages: 100 },
      });
      expect(
        body.offers.map((o: { amount: number }) => o.amount).sort((a: number, b: number) => a - b),
      ).toEqual([99_000, 249_000, 990_000, 2_490_000]);
    });

    it('is disabled without a provider: no offers, no error (AC11)', async () => {
      await build({ withProvider: false });
      const res = await overview(ALICE);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ enabled: false, offers: [] });
      const order = await create(ALICE, { plan: 'pro', period: 'month' });
      expect(order.statusCode).toBe(503);
      expect(order.json().error.code).toBe('BILLING_DISABLED');
    });

    it('hides plans lower than the one in force (G2)', async () => {
      await build();
      const order = await newOrder(ALICE, 'ultra');
      await pay(order);
      const body = (await overview(ALICE)).json();
      expect(body.current).toMatchObject({ plan: 'ultra', source: 'payment' });
      expect(body.offers.every((o: { plan: string }) => o.plan === 'ultra')).toBe(true);
    });
  });

  describe('create order', () => {
    it('creates an order with the server price, QR, transfer content and 15 minute limit (AC2)', async () => {
      await build();
      const order = await newOrder(ALICE, 'ultra', 'year');
      expect(order).toMatchObject({
        plan: 'ultra',
        period: 'year',
        amount: 2_490_000,
        status: 'pending',
        qrCode: expect.stringMatching(/^FAKEQR/),
        checkoutUrl: expect.stringContaining('https://pay.example/'),
        expiresAt: new Date(START.getTime() + 15 * MIN).toISOString(),
      });
      expect(order.transferContent).toBe(`CL${codeOf(order)}`);
      const sent = provider.created[0]!;
      expect(sent).toMatchObject({ amount: 2_490_000, description: order.transferContent });
      expect(sent.returnUrl).toBe(`http://localhost:3000/checkout?order=${order.id}`);
      expect(sent.cancelUrl).toBe(`http://localhost:3000/checkout?order=${order.id}&cancelled=1`);
    });

    it('takes the price from the server: a body with amount is refused (AC2)', async () => {
      await build();
      for (const payload of [
        { plan: 'pro', period: 'month', amount: 1 },
        { plan: 'free', period: 'month' },
        { plan: 'pro' },
        { plan: 'pro', period: 'month', userId: BOB },
      ]) {
        expect((await create(ALICE, payload)).statusCode).toBe(400);
      }
      expect(provider.created).toHaveLength(0);
    });

    it('returns the open order again instead of making another', async () => {
      await build();
      const first = await newOrder();
      const second = await newOrder();
      expect(second.id).toBe(first.id);
      expect(provider.created).toHaveLength(1);
      const other = await newOrder(ALICE, 'pro', 'year');
      expect(other.id).not.toBe(first.id);
    });

    it('cancels the order and answers 502 when the provider fails', async () => {
      await build();
      provider.failNextCheckout();
      const res = await create(ALICE, { plan: 'pro', period: 'month' });
      expect(res.statusCode).toBe(502);
      expect(res.json().error.code).toBe('BILLING_PROVIDER_FAILED');
      const items = (await list(ALICE)).json().items;
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ status: 'cancelled', qrCode: null });
    });

    it('answers 429 on the eleventh order within the hour', async () => {
      await build();
      const proMonth = { plan: 'pro', period: 'month' };
      let last = 0;
      for (let i = 0; i < 11; i += 1) {
        // Make each order unusable so the next call cannot reuse it: the provider says cancelled.
        const res = await create(ALICE, proMonth);
        last = res.statusCode;
        if (res.statusCode !== 201) break;
        const order = res.json();
        provider.setState(codeOf(order), { status: 'cancelled' });
        await getOrder(ALICE, order.id); // closes it as cancelled
        now = new Date(now.getTime() + 20_000);
      }
      expect(last).toBe(429);
    });

    it('answers 409 PLAN_DOWNGRADE when buying a lower plan (G2)', async () => {
      await build();
      await pay(await newOrder(ALICE, 'ultra'));
      const res = await create(ALICE, { plan: 'pro', period: 'month' });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PLAN_DOWNGRADE');
    });

    it('needs a signed-in user', async () => {
      await build();
      expect((await app.inject({ method: 'GET', url: '/v1/billing' })).statusCode).toBe(401);
      expect(
        (await app.inject({ method: 'POST', url: '/v1/billing/orders', payload: {} })).statusCode,
      ).toBe(401);
      expect((await app.inject({ method: 'GET', url: '/v1/billing/orders' })).statusCode).toBe(401);
    });
  });

  describe('webhook paid', () => {
    it('marks the order paid and raises the plan to the end of the period (AC3)', async () => {
      await build();
      const order = await newOrder();
      expect(await usagePlan(ALICE)).toBe('free');
      const res = await pay(order);
      expect(res.statusCode).toBe(200);
      expect(await usagePlan(ALICE)).toBe('pro');
      const after = (await getOrder(ALICE, order.id)).json();
      expect(after).toMatchObject({
        status: 'paid',
        qrCode: null,
        checkoutUrl: null,
        planExpiresAt: '2026-12-15T03:00:00.000Z',
      });
      expect((await overview(ALICE)).json().current).toEqual({
        plan: 'pro',
        expiresAt: '2026-12-15T03:00:00.000Z',
        source: 'payment',
      });
    });

    it('is idempotent: a repeated or parallel webhook adds the period once (AC3)', async () => {
      await build();
      const order = await newOrder();
      const results = await Promise.all(Array.from({ length: 5 }, () => pay(order)));
      expect(results.every((r) => r.statusCode === 200)).toBe(true);
      await pay(order);
      expect((await overview(ALICE)).json().current.expiresAt).toBe('2026-12-15T03:00:00.000Z');
    });

    it('ignores a signed webhook that is not a success', async () => {
      await build();
      const order = await newOrder();
      const res = await pay(order, { code: '01' });
      expect(res.statusCode).toBe(200);
      expect(await usagePlan(ALICE)).toBe('free');
    });

    it('extends from the current end date when buying the same plan again (AC8)', async () => {
      await build();
      await pay(await newOrder());
      now = new Date(START.getTime() + 10 * 86_400_000);
      await pay(await newOrder());
      expect((await overview(ALICE)).json().current.expiresAt).toBe('2027-01-15T03:00:00.000Z');
    });

    it('starts Ultra now and converts the Pro time left (Q4)', async () => {
      await build();
      await pay(await newOrder(ALICE, 'pro', 'month'));
      now = new Date(START.getTime() + 10 * 86_400_000); // Pro has 20 days left
      await pay(await newOrder(ALICE, 'ultra', 'month'));
      const current = (await overview(ALICE)).json().current;
      expect(current.plan).toBe('ultra');
      const leftMs = new Date('2026-12-15T03:00:00Z').getTime() - now.getTime();
      const expected = new Date(
        new Date('2026-12-25T03:00:00Z').getTime() + Math.round((leftMs * 99_000) / 249_000),
      );
      expect(current.expiresAt).toBe(expected.toISOString());
    });
  });

  describe('rejects bad webhook', () => {
    it('refuses a wrong signature without changing the plan (AC4)', async () => {
      await build();
      const order = await newOrder();
      const res = await pay(order, { signature: 'forged' });
      expect(res.statusCode).toBe(400);
      expect(await usagePlan(ALICE)).toBe('free');
      expect((await getOrder(ALICE, order.id)).json().status).toBe('pending');
    });

    it('refuses an amount that differs from the order (AC4)', async () => {
      await build();
      const order = await newOrder();
      const res = await webhook(provider.webhook({ orderCode: codeOf(order), amount: 2_000 }));
      expect(res.statusCode).toBe(400);
      expect(await usagePlan(ALICE)).toBe('free');
    });

    it('acknowledges a good signature for an unknown order and changes nothing (G1)', async () => {
      await build();
      const res = await webhook(provider.webhook({ orderCode: 123, amount: 3000 }));
      expect(res.statusCode).toBe(200);
      expect(await usagePlan(ALICE)).toBe('free');
    });

    it('refuses an unreadable body', async () => {
      await build();
      expect((await webhook({ hello: 'world' })).statusCode).toBe(400);
    });

    it('logs only the order code, never the body or the signature', async () => {
      await build();
      const order = await newOrder();
      await webhook(
        provider.webhook({ orderCode: codeOf(order), amount: 2_000, signature: 'valid' }),
      );
      await webhook(
        provider.webhook({ orderCode: codeOf(order), amount: 99_000, signature: 'forged-secret' }),
      );
      await pay(order);
      const all = logs.join('\n');
      expect(all).toContain(String(codeOf(order)));
      expect(all).not.toMatch(/forged-secret|"signature"|FAKEQR|signature":"valid/);
      expect(all).not.toContain('"body"');
    });
  });

  describe('order expiry', () => {
    it('marks an unpaid order expired after 15 minutes and drops the QR (AC6)', async () => {
      await build();
      const order = await newOrder();
      now = new Date(START.getTime() + 15 * MIN);
      const after = (await getOrder(ALICE, order.id)).json();
      expect(after).toMatchObject({ status: 'expired', qrCode: null, checkoutUrl: null });
      // A new order can be made.
      const fresh = await newOrder();
      expect(fresh.id).not.toBe(order.id);
    });

    it('does not accept a payment made after the order expired (AC6)', async () => {
      await build();
      const order = await newOrder();
      now = new Date(START.getTime() + 30 * MIN);
      const late = new Date(START.getTime() + 20 * MIN).toISOString();
      const res = await pay(order, { transactionDateTime: late });
      expect(res.statusCode).toBe(200);
      expect(await usagePlan(ALICE)).toBe('free');
      expect(logs.join('\n')).toContain('refund by hand');
    });

    it('accepts a payment made inside the window even if the webhook comes late (G3)', async () => {
      await build();
      const order = await newOrder();
      now = new Date(START.getTime() + 30 * MIN);
      await getOrder(ALICE, order.id); // closes it as expired
      const inside = new Date(START.getTime() + 5 * MIN).toISOString();
      await pay(order, { transactionDateTime: inside });
      expect(await usagePlan(ALICE)).toBe('pro');
    });
  });

  describe('status fallback', () => {
    it('asks the provider when the webhook never came, at most once per 15 seconds (AC5)', async () => {
      await build();
      const order = await newOrder();
      expect((await getOrder(ALICE, order.id)).json().status).toBe('pending');
      expect(provider.statusCalls).toHaveLength(1);
      now = new Date(now.getTime() + 3_000);
      await getOrder(ALICE, order.id);
      expect(provider.statusCalls).toHaveLength(1);
      provider.setState(codeOf(order), { status: 'paid', amountPaid: order.amount });
      now = new Date(now.getTime() + 13_000);
      const paid = (await getOrder(ALICE, order.id)).json();
      expect(provider.statusCalls).toHaveLength(2);
      expect(paid.status).toBe('paid');
      expect(await usagePlan(ALICE)).toBe('pro');
    });

    it('does not trust a paid status with a different amount', async () => {
      await build();
      const order = await newOrder();
      provider.setState(codeOf(order), { status: 'paid', amountPaid: 1 });
      expect((await getOrder(ALICE, order.id)).json().status).toBe('pending');
      expect(await usagePlan(ALICE)).toBe('free');
    });
  });

  describe('user boundary', () => {
    it('shows each person only their own orders (AC9)', async () => {
      await build();
      const mine = await newOrder(ALICE);
      const theirs = await newOrder(BOB, 'ultra', 'month');
      const aliceList = (await list(ALICE)).json().items;
      expect(aliceList.map((o: { id: string }) => o.id)).toEqual([mine.id]);
      expect(aliceList[0]).toMatchObject({
        plan: 'pro',
        period: 'month',
        amount: 99_000,
        status: 'pending',
      });
      expect((await list(BOB)).json().items.map((o: { id: string }) => o.id)).toEqual([theirs.id]);
    });

    it("answers 404 for someone else's order, and the status poll cannot settle it", async () => {
      await build();
      const mine = await newOrder(ALICE);
      expect((await getOrder(BOB, mine.id)).statusCode).toBe(404);
      expect(provider.statusCalls).toHaveLength(0);
    });

    it('moves only the plan of the order owner', async () => {
      await build();
      await pay(await newOrder(ALICE));
      expect(await usagePlan(ALICE)).toBe('pro');
      expect(await usagePlan(BOB)).toBe('free');
    });
  });

  it('keeps the webhook the only public billing route', async () => {
    await build();
    expect(
      (await app.inject({ method: 'GET', url: '/v1/billing/webhook/payos' })).statusCode,
    ).not.toBe(200);
    expect(
      (await app.inject({ method: 'POST', url: '/v1/billing/webhook/payos?x=1', payload: {} }))
        .statusCode,
    ).toBe(401);
  });
});
