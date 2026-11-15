import { describe, expect, it, vi } from 'vitest';
import { ApiError, createClient } from './index';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const limits = {
  translation_ms: 1,
  cloud_stt_ms: 1,
  debriefs: null,
  assist_daily: null,
  agent_messages: 100,
};
const order = {
  id: '0b9f2f5e-7c52-4d57-9d4c-1f5f3a7a9a10',
  plan: 'pro',
  period: 'month',
  amount: 99000,
  status: 'pending',
  transferContent: 'CL1000001',
  qrCode: '000201',
  checkoutUrl: 'https://pay.example/1',
  createdAt: '2026-11-15T00:00:00.000Z',
  expiresAt: '2026-11-15T00:15:00.000Z',
  paidAt: null,
  planExpiresAt: null,
  planApplied: false,
};
const make = (fetch: ReturnType<typeof vi.fn>) =>
  createClient({
    baseUrl: 'http://api',
    getToken: () => 't0k',
    fetch: fetch as unknown as typeof globalThis.fetch,
  });

describe('billing client', () => {
  it('reads the overview with the token', async () => {
    const fetch = vi.fn().mockResolvedValue(
      json(200, {
        enabled: true,
        current: { plan: 'free', expiresAt: null, source: null },
        offers: [{ plan: 'pro', period: 'month', amount: 99000, limits }],
      }),
    );
    const result = await make(fetch).billing.overview();
    expect(result.offers[0]?.amount).toBe(99000);
    expect(fetch.mock.calls[0]?.[0]).toBe('http://api/v1/billing');
    expect(fetch.mock.calls[0]?.[1].headers.authorization).toBe('Bearer t0k');
  });

  it('creates an order sending only plan and period', async () => {
    const fetch = vi.fn().mockResolvedValue(json(201, order));
    const result = await make(fetch).billing.createOrder({ plan: 'pro', period: 'month' });
    expect(result.transferContent).toBe('CL1000001');
    expect(fetch.mock.calls[0]?.[1].method).toBe('POST');
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({ plan: 'pro', period: 'month' });
  });

  it('polls one order and lists orders', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        json(200, { ...order, status: 'paid', qrCode: null, checkoutUrl: null }),
      )
      .mockResolvedValueOnce(json(200, { items: [order] }));
    const client = make(fetch);
    expect((await client.billing.getOrder(order.id)).status).toBe('paid');
    expect(fetch.mock.calls[0]?.[0]).toBe(`http://api/v1/billing/orders/${order.id}`);
    expect(await client.billing.listOrders()).toHaveLength(1);
    expect(fetch.mock.calls[1]?.[0]).toBe('http://api/v1/billing/orders');
  });

  it('keeps the error code of a refused purchase', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(json(409, { error: { code: 'PLAN_DOWNGRADE', message: 'x' } }));
    const error = await make(fetch)
      .billing.createOrder({ plan: 'pro', period: 'year' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'PLAN_DOWNGRADE' });
  });

  it('fails loudly when the server breaks the contract', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { ...order, status: 'refunded' }));
    await expect(make(fetch).billing.getOrder(order.id)).rejects.toThrow();
  });
});
