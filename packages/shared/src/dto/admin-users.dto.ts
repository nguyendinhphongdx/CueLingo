import { z } from 'zod';
import { BillingPeriodSchema, PaidPlanSchema, PlanSourceSchema } from '../billing';
import { PlanSchema } from '../plans';
import { BillingOrderStatusSchema } from './billing.dto';
import { UsageResponseSchema } from './usage.dto';

/**
 * Admin users screen. Unlike `AdminMetrics` (aggregates, no identifiers) these shapes DO carry email and name:
 * only callers in `ADMIN_EMAILS` get them. They never carry meeting titles, transcripts or phrases.
 */

/** `GET /v1/admin/dashboard`. Money is VND, whole dong. Paid plans count only while they are in force. */
export const AdminDashboardSchema = z
  .object({
    generatedAt: z.iso.datetime(),
    totalUsers: z.number().int().min(0),
    /** Plans in force now: `free` is everyone who is not on a live Pro or Ultra plan. */
    byPlan: z
      .object({
        free: z.number().int().min(0),
        pro: z.number().int().min(0),
        ultra: z.number().int().min(0),
      })
      .strict(),
    newUsers7d: z.number().int().min(0),
    /** Sum of `paid` orders whose `paidAt` is in the current calendar month, Vietnam time. */
    revenueThisMonth: z.number().int().min(0),
    /** Pro/Ultra plans (bought or set by hand) that end within the next 7 days. */
    expiringIn7d: z.number().int().min(0),
  })
  .strict();
export type AdminDashboard = z.infer<typeof AdminDashboardSchema>;

/** Query of `GET /v1/admin/users`. Every field is optional; the page size is fixed by the server. */
export const AdminUserListQuerySchema = z
  .object({
    /** Case-insensitive text contained in the email or the name. */
    q: z.string().trim().max(100).optional(),
    /** The plan in force, so `free` includes people whose paid plan has ended. */
    plan: PlanSchema.optional(),
    /** `1` = only Pro/Ultra plans ending within 7 days. */
    expiring: z.literal('1').optional(),
    /** Opaque; take it from `nextCursor` of the previous page. */
    cursor: z.string().min(1).max(200).optional(),
  })
  .strict();
export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>;

/**
 * One person. `plan` is the plan in force. `source` and `expiresAt` describe the stored row, so a plan that has
 * ended reads `plan: 'free'` with the old `expiresAt`. No plan row = `source: null`, `expiresAt: null`.
 */
export const AdminUserRowSchema = z
  .object({
    id: z.uuid(),
    email: z.string(),
    name: z.string(),
    createdAt: z.iso.datetime(),
    plan: PlanSchema,
    source: PlanSourceSchema.nullable(),
    expiresAt: z.iso.datetime().nullable(),
    /** Milliseconds of live translation used this month (Vietnam time). */
    translationMsThisMonth: z.number().int().min(0),
    /** Start of the latest meeting that was not deleted. */
    lastActiveAt: z.iso.datetime().nullable(),
  })
  .strict();
export type AdminUserRow = z.infer<typeof AdminUserRowSchema>;

export const AdminUserListSchema = z
  .object({ items: z.array(AdminUserRowSchema), nextCursor: z.string().nullable() })
  .strict();
export type AdminUserList = z.infer<typeof AdminUserListSchema>;

/** An order as the admin sees it: no QR payload, no checkout link, no transfer content. */
export const AdminUserOrderSchema = z
  .object({
    id: z.uuid(),
    plan: PaidPlanSchema,
    period: BillingPeriodSchema,
    amount: z.number().int().positive(),
    status: BillingOrderStatusSchema,
    createdAt: z.iso.datetime(),
    paidAt: z.iso.datetime().nullable(),
    planExpiresAt: z.iso.datetime().nullable(),
  })
  .strict();
export type AdminUserOrder = z.infer<typeof AdminUserOrderSchema>;

/** `GET /v1/admin/users/:id`. `usage` is exactly what `GET /v1/me/usage` answers for that person. */
export const AdminUserDetailSchema = z
  .object({
    user: AdminUserRowSchema,
    usage: UsageResponseSchema,
    orders: z.array(AdminUserOrderSchema),
  })
  .strict();
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;

/** `PUT /v1/admin/users/:id/plan`. The person comes from the path, the admin from the session. */
export const AdminSetUserPlanRequestSchema = z
  .object({
    plan: PlanSchema,
    /** When a paid plan ends. Omitted = never. Ignored for `free`. Must be in the future. */
    expiresAt: z.iso.datetime().optional(),
  })
  .strict();
export type AdminSetUserPlanRequest = z.infer<typeof AdminSetUserPlanRequestSchema>;

/** The stored plan after the change; the source is always `manual`. */
export const AdminSetUserPlanResponseSchema = z
  .object({ plan: PlanSchema, source: z.literal('manual'), expiresAt: z.iso.datetime().nullable() })
  .strict();
export type AdminSetUserPlanResponse = z.infer<typeof AdminSetUserPlanResponseSchema>;
