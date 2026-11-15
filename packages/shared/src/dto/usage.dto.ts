import { z } from 'zod';
import { PlanSchema, UsageMetricSchema, UsageStateSchema, USAGE_METRICS } from '../plans';

/** One allowance. `limit: null` = unlimited. `*_ms` metrics are milliseconds, the rest are counts. */
export const UsageItemSchema = z
  .object({
    used: z.number().int().min(0),
    limit: z.number().int().min(0).nullable(),
    resetsAt: z.iso.datetime(),
    state: UsageStateSchema,
  })
  .strict();
export type UsageItem = z.infer<typeof UsageItemSchema>;

export const UsageResponseSchema = z
  .object({
    plan: PlanSchema,
    usage: z.object(
      Object.fromEntries(USAGE_METRICS.map((m) => [m, UsageItemSchema])) as Record<
        (typeof USAGE_METRICS)[number],
        typeof UsageItemSchema
      >,
    ),
  })
  .strict();
export type UsageResponse = z.infer<typeof UsageResponseSchema>;

/** `details` of a `QUOTA_EXCEEDED` error. */
export const QuotaExceededDetailsSchema = z
  .object({
    metric: UsageMetricSchema,
    plan: PlanSchema,
    used: z.number().int().min(0),
    limit: z.number().int().min(0),
    resetsAt: z.iso.datetime(),
  })
  .strict();
export type QuotaExceededDetails = z.infer<typeof QuotaExceededDetailsSchema>;

/** `details` of a `DEBRIEF_SKIPPED` error. */
export const DebriefSkippedDetailsSchema = z.object({ reason: z.literal('quota') }).strict();
export type DebriefSkippedDetails = z.infer<typeof DebriefSkippedDetailsSchema>;

/** Admin only. The target is picked by email; the caller's own id never comes from the body. */
export const SetPlanRequestSchema = z
  .object({
    email: z.email().max(254),
    plan: PlanSchema,
    /** When the plan ends and the user falls back to Free. Omitted = never (as in W2-02). */
    expiresAt: z.iso.datetime().optional(),
  })
  .strict();
export type SetPlanRequest = z.infer<typeof SetPlanRequestSchema>;

export const SetPlanResponseSchema = z
  .object({
    email: z.string(),
    plan: PlanSchema,
    expiresAt: z.iso.datetime().nullable().optional(),
  })
  .strict();
export type SetPlanResponse = z.infer<typeof SetPlanResponseSchema>;
