import { z } from 'zod';
import type { Plan } from './plans';

/**
 * Prices, billing periods and what a purchase does to a plan. Pure: no I/O, no clock.
 * Only the API reads prices (`PLAN_PRICES`); clients get the offers from `GET /v1/billing`.
 */

export const BillingPeriodSchema = z.enum(['month', 'year']);
export type BillingPeriod = z.infer<typeof BillingPeriodSchema>;

/** Plans that can be bought. `free` cannot. */
export const PaidPlanSchema = z.enum(['pro', 'ultra']);
export type PaidPlan = z.infer<typeof PaidPlanSchema>;

/** Why a plan row exists: set by an admin, or bought. */
export const PlanSourceSchema = z.enum(['manual', 'payment']);
export type PlanSource = z.infer<typeof PlanSourceSchema>;

/** VND, whole dong. A year costs 10 months. */
export type PlanPriceTable = Record<PaidPlan, Record<BillingPeriod, number>>;
export const DEFAULT_PLAN_PRICES: PlanPriceTable = {
  pro: { month: 99_000, year: 990_000 },
  ultra: { month: 249_000, year: 2_490_000 },
};

const PriceValueSchema = z.number().int().positive();
const PriceOverrideSchema = z
  .object({ month: PriceValueSchema, year: PriceValueSchema })
  .partial()
  .strict();

/** Value of the `PLAN_PRICES` env var: a partial override of {@link DEFAULT_PLAN_PRICES}. */
export const PlanPricesOverrideSchema = z
  .object({ pro: PriceOverrideSchema, ultra: PriceOverrideSchema })
  .partial()
  .strict();
export type PlanPricesOverride = z.infer<typeof PlanPricesOverrideSchema>;

export function resolvePlanPrices(override: PlanPricesOverride = {}): PlanPriceTable {
  const out = structuredClone(DEFAULT_PLAN_PRICES);
  for (const plan of PaidPlanSchema.options) Object.assign(out[plan], override[plan] ?? {});
  return out;
}

/** The `PLAN_PRICES` environment variable: JSON text in, resolved price table out; absent means the defaults. */
export const PlanPricesEnvSchema = z
  .string()
  .transform((value, ctx): PlanPriceTable => {
    let json: unknown;
    try {
      json = JSON.parse(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'PLAN_PRICES must be valid JSON' });
      return z.NEVER;
    }
    const parsed = PlanPricesOverrideSchema.safeParse(json);
    if (!parsed.success) {
      const problems = parsed.error.issues.map(
        (i) => `${i.path.join('.') || 'value'}: ${i.message}`,
      );
      ctx.addIssue({
        code: 'custom',
        message: `PLAN_PRICES is not valid (${problems.join('; ')})`,
      });
      return z.NEVER;
    }
    return resolvePlanPrices(parsed.data);
  })
  .default(() => resolvePlanPrices());

/** Vietnam is UTC+7 with no daylight saving. */
const VN_OFFSET_MS = 7 * 3_600_000;

/**
 * One period after `from`, on the Vietnam calendar: a month is +1 calendar month, a year is +12. When the
 * target month is shorter the last day of that month is used (31 Jan -> 28 Feb). Time of day is kept.
 */
export function addPeriod(from: Date, period: BillingPeriod): Date {
  const local = new Date(from.getTime() + VN_OFFSET_MS);
  const months = period === 'year' ? 12 : 1;
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const target = Date.UTC(
    year,
    month,
    Math.min(local.getUTCDate(), lastDay),
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds(),
  );
  return new Date(target - VN_OFFSET_MS);
}

/** A stored plan row. `expiresAt: null` = never expires (admin-set). */
export interface PlanRow {
  plan: Plan;
  expiresAt: Date | null;
  source: PlanSource;
}

/** The plan in force at `now`: an expired paid plan counts as `free`. No row = `free`. */
export function effectivePlan(row: Pick<PlanRow, 'plan' | 'expiresAt'> | null, now: Date): Plan {
  if (!row) return 'free';
  if (row.expiresAt !== null && row.expiresAt.getTime() <= now.getTime()) return 'free';
  return row.plan;
}

const RANK: Record<Plan, number> = { free: 0, pro: 1, ultra: 2 };

export type PurchaseOutcome =
  { ok: true; plan: PaidPlan; expiresAt: Date } | { ok: false; reason: 'downgrade' };

/**
 * What the plan row becomes after a paid purchase (spec Q4, AC8):
 * - on Free (or expired): starts now;
 * - same plan with an end date: extends from that date;
 * - Pro -> Ultra: Ultra starts now and the Pro time left is converted by monthly price ratio;
 * - a lower plan, or the same plan with no end date (admin-set): refused.
 */
export function planAfterPurchase(input: {
  current: PlanRow | null;
  now: Date;
  plan: PaidPlan;
  period: BillingPeriod;
  prices: PlanPriceTable;
}): PurchaseOutcome {
  const { current, now, plan, period, prices } = input;
  const active = effectivePlan(current, now);
  const fresh = (): PurchaseOutcome => ({ ok: true, plan, expiresAt: addPeriod(now, period) });
  if (active === 'free' || !current) return fresh();
  if (RANK[plan] < RANK[active]) return { ok: false, reason: 'downgrade' };

  if (plan === active) {
    if (current.expiresAt === null) return { ok: false, reason: 'downgrade' };
    return { ok: true, plan, expiresAt: addPeriod(current.expiresAt, period) };
  }

  // Upgrade (Pro -> Ultra). With no end date there is nothing to convert.
  const base = addPeriod(now, period);
  if (current.expiresAt === null) return { ok: true, plan, expiresAt: base };
  const leftMs = current.expiresAt.getTime() - now.getTime();
  const ratio = prices[active as PaidPlan].month / prices[plan].month;
  return { ok: true, plan, expiresAt: new Date(base.getTime() + Math.round(leftMs * ratio)) };
}
