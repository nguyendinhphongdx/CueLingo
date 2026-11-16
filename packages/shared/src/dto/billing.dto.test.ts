import { describe, expect, it } from 'vitest';
import {
  BillingOrderSchema,
  BillingOverviewResponseSchema,
  CreateOrderRequestSchema,
} from './billing.dto';
import { SetPlanRequestSchema } from './usage.dto';

describe('CreateOrderRequestSchema', () => {
  it('takes only plan and period; a client price is refused', () => {
    expect(CreateOrderRequestSchema.safeParse({ plan: 'pro', period: 'month' }).success).toBe(true);
    expect(
      CreateOrderRequestSchema.safeParse({ plan: 'pro', period: 'month', amount: 1 }).success,
    ).toBe(false);
    expect(CreateOrderRequestSchema.safeParse({ plan: 'free', period: 'month' }).success).toBe(
      false,
    );
    expect(CreateOrderRequestSchema.safeParse({ plan: 'pro', period: 'week' }).success).toBe(false);
  });
});

describe('BillingOverviewResponseSchema', () => {
  it('accepts a disabled overview with no offers', () => {
    const body = {
      enabled: false,
      current: { plan: 'free', expiresAt: null, source: null },
      offers: [],
    };
    expect(BillingOverviewResponseSchema.safeParse(body).success).toBe(true);
  });
});

describe('BillingOrderSchema', () => {
  it('rejects an unknown status', () => {
    const order = {
      id: '0b9f2f5e-7c52-4d57-9d4c-1f5f3a7a9a10',
      plan: 'pro',
      period: 'month',
      amount: 99000,
      byAdmin: false,
      status: 'refunded',
      transferContent: 'CL1000001',
      qrCode: null,
      checkoutUrl: null,
      createdAt: '2026-11-15T00:00:00.000Z',
      expiresAt: '2026-11-15T00:15:00.000Z',
      paidAt: null,
      planExpiresAt: null,
      planApplied: false,
    };
    expect(BillingOrderSchema.safeParse(order).success).toBe(false);
    expect(BillingOrderSchema.safeParse({ ...order, status: 'pending' }).success).toBe(true);
  });
});

describe('SetPlanRequestSchema period', () => {
  it('is required for a paid plan and absent for free; expiresAt is gone', () => {
    const ok = (body: object) =>
      SetPlanRequestSchema.safeParse({ email: 'a@b.co', ...body }).success;
    expect(ok({ plan: 'pro', period: 'month' })).toBe(true);
    expect(ok({ plan: 'ultra', period: 'year' })).toBe(true);
    expect(ok({ plan: 'free' })).toBe(true);
    expect(ok({ plan: 'pro' })).toBe(false);
    expect(ok({ plan: 'free', period: 'month' })).toBe(false);
    expect(ok({ plan: 'pro', period: 'week' })).toBe(false);
    expect(ok({ plan: 'pro', period: 'month', expiresAt: '2027-01-01T00:00:00Z' })).toBe(false);
  });
});

describe('BillingOrderSchema grant by an admin', () => {
  it('allows a 0 dong order marked byAdmin', () => {
    const order = {
      id: '11111111-1111-4111-8111-111111111111',
      plan: 'pro',
      period: 'month',
      amount: 0,
      byAdmin: true,
      status: 'paid',
      transferContent: 'CL1000000',
      qrCode: null,
      checkoutUrl: null,
      createdAt: '2026-11-16T03:00:00.000Z',
      expiresAt: '2026-11-16T03:00:00.000Z',
      paidAt: '2026-11-16T03:00:00.000Z',
      planExpiresAt: '2026-12-16T03:00:00.000Z',
      planApplied: true,
    };
    expect(BillingOrderSchema.safeParse(order).success).toBe(true);
    expect(BillingOrderSchema.safeParse({ ...order, amount: -1 }).success).toBe(false);
  });
});
