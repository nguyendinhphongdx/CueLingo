import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_PRICES,
  PlanPricesEnvSchema,
  addPeriod,
  effectivePlan,
  planAfterPurchase,
  type PlanRow,
} from './billing';

const prices = DEFAULT_PLAN_PRICES;
const at = (iso: string) => new Date(iso);

describe('addPeriod (Vietnam calendar)', () => {
  it('adds a calendar month', () => {
    expect(addPeriod(at('2026-11-15T03:00:00Z'), 'month').toISOString()).toBe(
      '2026-12-15T03:00:00.000Z',
    );
  });

  it('clamps to the last day of a shorter month', () => {
    // 2026-01-31 10:00 VN -> 2026-02-28 10:00 VN
    expect(addPeriod(at('2026-01-31T03:00:00Z'), 'month').toISOString()).toBe(
      '2026-02-28T03:00:00.000Z',
    );
  });

  it('uses the Vietnam date, not the UTC date, near midnight', () => {
    // 2026-01-30T20:00Z is 2026-01-31 03:00 in Vietnam -> 28 Feb 03:00 VN = 27 Feb 20:00Z
    expect(addPeriod(at('2026-01-30T20:00:00Z'), 'month').toISOString()).toBe(
      '2026-02-27T20:00:00.000Z',
    );
  });

  it('a year is 12 months and handles 29 Feb', () => {
    expect(addPeriod(at('2028-02-29T03:00:00Z'), 'year').toISOString()).toBe(
      '2029-02-28T03:00:00.000Z',
    );
  });
});

describe('effectivePlan', () => {
  const now = at('2026-11-15T00:00:00Z');
  it('is free without a row, or after the end date', () => {
    expect(effectivePlan(null, now)).toBe('free');
    expect(effectivePlan({ plan: 'pro', expiresAt: at('2026-11-15T00:00:00Z') }, now)).toBe('free');
  });
  it('keeps the plan before the end date or with none', () => {
    expect(effectivePlan({ plan: 'pro', expiresAt: at('2026-11-15T00:00:01Z') }, now)).toBe('pro');
    expect(effectivePlan({ plan: 'ultra', expiresAt: null }, now)).toBe('ultra');
  });
});

describe('planAfterPurchase', () => {
  const now = at('2026-11-15T03:00:00Z');
  const buy = (
    current: PlanRow | null,
    plan: 'pro' | 'ultra',
    period: 'month' | 'year' = 'month',
  ) => planAfterPurchase({ current, now, plan, period, prices });

  it('starts now from free', () => {
    expect(buy(null, 'pro')).toEqual({
      ok: true,
      plan: 'pro',
      expiresAt: at('2026-12-15T03:00:00Z'),
    });
  });

  it('starts now when the old plan expired', () => {
    const old: PlanRow = {
      plan: 'ultra',
      expiresAt: at('2026-11-01T00:00:00Z'),
      source: 'payment',
    };
    expect(buy(old, 'pro')).toEqual({
      ok: true,
      plan: 'pro',
      expiresAt: at('2026-12-15T03:00:00Z'),
    });
  });

  it('extends the same plan from its end date (AC8)', () => {
    const cur: PlanRow = { plan: 'pro', expiresAt: at('2026-12-01T03:00:00Z'), source: 'payment' };
    expect(buy(cur, 'pro')).toEqual({
      ok: true,
      plan: 'pro',
      expiresAt: at('2027-01-01T03:00:00Z'),
    });
  });

  it('converts remaining Pro time into Ultra time by price ratio (Q4)', () => {
    const cur: PlanRow = { plan: 'pro', expiresAt: at('2026-11-25T03:00:00Z'), source: 'payment' };
    const out = buy(cur, 'ultra');
    const leftMs = 10 * 86_400_000;
    const extra = Math.round((leftMs * 99_000) / 249_000);
    expect(out).toEqual({
      ok: true,
      plan: 'ultra',
      expiresAt: new Date(at('2026-12-15T03:00:00Z').getTime() + extra),
    });
  });

  it('refuses a lower plan, and the same plan with no end date', () => {
    expect(
      buy({ plan: 'ultra', expiresAt: at('2027-01-01T00:00:00Z'), source: 'payment' }, 'pro'),
    ).toEqual({
      ok: false,
      reason: 'downgrade',
    });
    expect(buy({ plan: 'pro', expiresAt: null, source: 'manual' }, 'pro')).toEqual({
      ok: false,
      reason: 'downgrade',
    });
  });

  it('lets an admin-set Pro with no end date upgrade to Ultra with nothing to convert', () => {
    expect(buy({ plan: 'pro', expiresAt: null, source: 'manual' }, 'ultra')).toEqual({
      ok: true,
      plan: 'ultra',
      expiresAt: at('2026-12-15T03:00:00Z'),
    });
  });
});

describe('PlanPricesEnvSchema', () => {
  it('defaults when absent and overrides partially', () => {
    expect(PlanPricesEnvSchema.parse(undefined)).toEqual(DEFAULT_PLAN_PRICES);
    expect(PlanPricesEnvSchema.parse('{"pro":{"month":2000}}').pro).toEqual({
      month: 2000,
      year: 990_000,
    });
  });
  it('rejects bad json, unknown plans and non-positive prices', () => {
    expect(PlanPricesEnvSchema.safeParse('nope').success).toBe(false);
    expect(PlanPricesEnvSchema.safeParse('{"free":{"month":1}}').success).toBe(false);
    expect(PlanPricesEnvSchema.safeParse('{"pro":{"month":0}}').success).toBe(false);
    expect(PlanPricesEnvSchema.safeParse('{"pro":{"month":1.5}}').success).toBe(false);
  });
});
