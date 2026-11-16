import {
  AdminDashboardSchema,
  AdminSetUserPlanRequestSchema,
  AdminUserListQuerySchema,
  ErrorCode,
  type AdminDashboard,
  type AdminSetUserPlanResponse,
  type AdminUserDetail,
  type AdminUserList,
} from '@cuelingo/shared';
import { z } from 'zod';
import { AppError } from '../../lib/errors';
import { IdParamsSchema, parse } from '../../lib/http';
import type { BillingService } from '../billing';
import type { UsageService } from '../usage';
import type { AdminUsersRepository, UserCursor } from './admin-users.repository';

export type AdminUsersService = ReturnType<typeof createAdminUsersService>;

/** Rows per page (AC2). */
export const PAGE_SIZE = 50;

export interface AdminUsersOptions {
  isAdmin: (userId: string) => Promise<boolean>;
  /** The gate of the usage module: this module reads usage and plans through it and never writes `user_plans`. */
  usage: Pick<UsageService, 'snapshot' | 'setPlanFor'>;
  billing: Pick<BillingService, 'listOrders'>;
  now?: () => Date;
}

/** A UTC timestamp (Postgres writes microseconds) and a uuid: nothing else reaches the SQL. */
const CursorSchema = z
  .object({
    createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/),
    id: z.uuid(),
  })
  .strict();

/**
 * Postgres refuses 2026-02-30 and year 0000 with an error, which would be a 500. `new Date` alone is not enough
 * (it accepts year 0000 and, for some forms, rolls an impossible day over), so the text must survive a round trip
 * to the second, and the year must be 1 or later.
 */
export function isRealInstant(text: string): boolean {
  const at = new Date(text);
  if (Number.isNaN(at.getTime()) || at.getUTCFullYear() < 1) return false;
  return at.toISOString().slice(0, 19) === text.slice(0, 19);
}

const encodeCursor = (cursor: UserCursor) =>
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');

function decodeCursor(text: string): UserCursor {
  const bad = () => new AppError(ErrorCode.Validation, 'Invalid cursor');
  try {
    const parsed = CursorSchema.safeParse(
      JSON.parse(Buffer.from(text, 'base64url').toString('utf8')),
    );
    if (!parsed.success || !isRealInstant(parsed.data.createdAt)) throw bad();
    return parsed.data;
  } catch {
    throw bad();
  }
}

/**
 * Admin view of people and plans. Every method checks `ADMIN_EMAILS` first, before it reads the input or the
 * database, so a stranger gets 403 whatever they send (even an id that does not exist).
 */
export function createAdminUsersService(repo: AdminUsersRepository, options: AdminUsersOptions) {
  const now = options.now ?? (() => new Date());

  async function requireAdmin(userId: string): Promise<void> {
    if (!(await options.isAdmin(userId))) {
      throw new AppError(ErrorCode.Forbidden, 'Admin access required');
    }
  }

  return {
    async dashboard(adminId: string): Promise<AdminDashboard> {
      await requireAdmin(adminId);
      return AdminDashboardSchema.parse(await repo.dashboard(now()));
    },

    /** `query` is the raw query string object. */
    async list(adminId: string, query: unknown): Promise<AdminUserList> {
      await requireAdmin(adminId);
      const input = parse(AdminUserListQuerySchema, query);
      const page = await repo.list(
        {
          q: input.q || undefined,
          plan: input.plan,
          expiring: input.expiring === '1',
          after: input.cursor ? decodeCursor(input.cursor) : undefined,
        },
        now(),
        PAGE_SIZE,
      );
      return { items: page.items, nextCursor: page.next ? encodeCursor(page.next) : null };
    },

    async detail(adminId: string, params: unknown): Promise<AdminUserDetail> {
      await requireAdmin(adminId);
      const { id } = parse(IdParamsSchema, params);
      const user = await repo.find(id, now());
      if (!user) throw new AppError(ErrorCode.NotFound, 'User not found');
      const [usage, orders] = await Promise.all([
        options.usage.snapshot(id),
        options.billing.listOrders(id),
      ]);
      return {
        user,
        usage,
        // Pick the fields on purpose: the billing order also holds the QR payload and the checkout link.
        orders: orders.items.map((o) => ({
          id: o.id,
          plan: o.plan,
          period: o.period,
          amount: o.amount,
          status: o.status,
          createdAt: o.createdAt,
          paidAt: o.paidAt,
          planExpiresAt: o.planExpiresAt,
        })),
      };
    },

    /** The person is the path id; the admin is the session. The usage module checks the plan and logs it. */
    async setPlan(
      adminId: string,
      params: unknown,
      body: unknown,
    ): Promise<AdminSetUserPlanResponse> {
      await requireAdmin(adminId);
      const { id } = parse(IdParamsSchema, params);
      const input = parse(AdminSetUserPlanRequestSchema, body);
      if (!(await repo.find(id, now()))) throw new AppError(ErrorCode.NotFound, 'User not found');
      const { current } = await options.usage.setPlanFor(adminId, id, input.plan, input.expiresAt);
      return {
        plan: current.plan,
        source: 'manual',
        expiresAt: current.expiresAt?.toISOString() ?? null,
      };
    },
  };
}
