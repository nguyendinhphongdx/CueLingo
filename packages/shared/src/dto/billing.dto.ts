import { z } from 'zod';
import { BillingPeriodSchema, PaidPlanSchema, PlanSourceSchema } from '../billing';
import { PlanSchema, USAGE_METRICS } from '../plans';

/** What the user may buy. Price is VND and comes from the server; `limits` are the allowances of that plan. */
export const BillingOfferSchema = z
  .object({
    plan: PaidPlanSchema,
    period: BillingPeriodSchema,
    amount: z.number().int().positive(),
    limits: z.object(
      Object.fromEntries(
        USAGE_METRICS.map((m) => [m, z.number().int().min(0).nullable()]),
      ) as Record<(typeof USAGE_METRICS)[number], z.ZodNullable<z.ZodNumber>>,
    ),
  })
  .strict();
export type BillingOffer = z.infer<typeof BillingOfferSchema>;

/**
 * `GET /v1/billing`. `enabled: false` (no PayOS keys) means hide the upgrade button; `offers` is then empty.
 * `current.source` is null when the user has no plan row.
 */
export const BillingOverviewResponseSchema = z
  .object({
    enabled: z.boolean(),
    current: z
      .object({
        plan: PlanSchema,
        expiresAt: z.iso.datetime().nullable(),
        source: PlanSourceSchema.nullable(),
      })
      .strict(),
    offers: z.array(BillingOfferSchema),
  })
  .strict();
export type BillingOverviewResponse = z.infer<typeof BillingOverviewResponseSchema>;

/** The client never sends a price: only what to buy. */
export const CreateOrderRequestSchema = z
  .object({ plan: PaidPlanSchema, period: BillingPeriodSchema })
  .strict();
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

export const BillingOrderStatusSchema = z.enum(['pending', 'paid', 'expired', 'cancelled']);
export type BillingOrderStatus = z.infer<typeof BillingOrderStatusSchema>;

/**
 * One order of the signed-in user. `qrCode` (the VietQR payload to draw) and `checkoutUrl` are set only while
 * the order is `pending`. `transferContent` is what the payer types in the bank app.
 */
export const BillingOrderSchema = z
  .object({
    id: z.uuid(),
    plan: PaidPlanSchema,
    period: BillingPeriodSchema,
    amount: z.number().int().positive(),
    status: BillingOrderStatusSchema,
    transferContent: z.string(),
    qrCode: z.string().nullable(),
    checkoutUrl: z.string().nullable(),
    createdAt: z.iso.datetime(),
    /** When payment stops being accepted. */
    expiresAt: z.iso.datetime(),
    paidAt: z.iso.datetime().nullable(),
    /** The paid plan's end date once the order is `paid`. */
    planExpiresAt: z.iso.datetime().nullable(),
  })
  .strict();
export type BillingOrder = z.infer<typeof BillingOrderSchema>;

export const BillingOrderListSchema = z.object({ items: z.array(BillingOrderSchema) }).strict();
export type BillingOrderList = z.infer<typeof BillingOrderListSchema>;
