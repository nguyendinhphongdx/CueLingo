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
      status: 'refunded',
      transferContent: 'CL1000001',
      qrCode: null,
      checkoutUrl: null,
      createdAt: '2026-11-15T00:00:00.000Z',
      expiresAt: '2026-11-15T00:15:00.000Z',
      paidAt: null,
      planExpiresAt: null,
    };
    expect(BillingOrderSchema.safeParse(order).success).toBe(false);
    expect(BillingOrderSchema.safeParse({ ...order, status: 'pending' }).success).toBe(true);
  });
});

describe('SetPlanRequestSchema expiresAt', () => {
  it('is optional and must be an ISO datetime', () => {
    expect(SetPlanRequestSchema.safeParse({ email: 'a@b.co', plan: 'pro' }).success).toBe(true);
    expect(
      SetPlanRequestSchema.safeParse({
        email: 'a@b.co',
        plan: 'pro',
        expiresAt: '2027-01-01T00:00:00Z',
      }).success,
    ).toBe(true);
    expect(
      SetPlanRequestSchema.safeParse({ email: 'a@b.co', plan: 'pro', expiresAt: 'tomorrow' })
        .success,
    ).toBe(false);
  });
});
