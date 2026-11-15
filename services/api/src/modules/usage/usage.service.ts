import {
  ErrorCode,
  USAGE_METRICS,
  periodEnd,
  periodStart,
  quotaState,
  type Plan,
  type PlanLimitTable,
  type QuotaExceededDetails,
  type SetPlanResponse,
  type UsageItem,
  type UsageMetric,
  type UsageResponse,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { PeriodStarts, UsageRepository } from './usage.repository';

export type UsageService = ReturnType<typeof createUsageService>;

export type ReserveResult =
  { ok: true; item: UsageItem } | { ok: false; details: QuotaExceededDetails };

export interface UsageOptions {
  limits: PlanLimitTable;
  /** Admins have no limit (AC12) but are still counted, to see the cost of testing. */
  isAdmin: (userId: string) => Promise<boolean>;
  now?: () => Date;
}

/** Plans, counting and the quota gate. Other modules receive this service, never the repository. */
export function createUsageService(repo: UsageRepository, options: UsageOptions) {
  const now = options.now ?? (() => new Date());

  const startsAt = (at: Date): PeriodStarts =>
    Object.fromEntries(USAGE_METRICS.map((m) => [m, periodStart(m, at)])) as PeriodStarts;

  const itemOf = (
    metric: UsageMetric,
    used: number,
    limit: number | null,
    at: Date,
  ): UsageItem => ({
    used,
    limit,
    resetsAt: periodEnd(metric, at).toISOString(),
    state: quotaState(metric, used, limit),
  });

  /** What a gate needs for one metric: a single query by primary key, with the admin check beside it. */
  async function gateOf(userId: string, metric: UsageMetric, at: Date, admin?: boolean) {
    const [row, isAdmin] = await Promise.all([
      repo.gate(userId, metric, periodStart(metric, at), at),
      admin ?? options.isAdmin(userId),
    ]);
    return {
      plan: row.plan,
      used: row.amount,
      limit: isAdmin ? null : options.limits[row.plan][metric],
    };
  }

  const exceeded = (plan: Plan, metric: UsageMetric, used: number, limit: number, at: Date) => ({
    metric,
    plan,
    used,
    limit,
    resetsAt: periodEnd(metric, at).toISOString(),
  });

  /** Takes `amount` before the work starts. Atomic: two requests cannot both take the last slot. */
  async function tryReserve(
    userId: string,
    metric: UsageMetric,
    amount = 1,
  ): Promise<ReserveResult> {
    const at = now();
    const { plan, used, limit } = await gateOf(userId, metric, at);
    const start = periodStart(metric, at);
    if (limit === null) {
      return {
        ok: true,
        item: itemOf(metric, await repo.add(userId, metric, start, amount), null, at),
      };
    }
    const total = limit > 0 ? await repo.reserve(userId, metric, start, amount, limit) : null;
    if (total === null) {
      return { ok: false, details: exceeded(plan, metric, used, limit, at) };
    }
    return { ok: true, item: itemOf(metric, total, limit, at) };
  }

  return {
    tryReserve,

    /** AC3: the plan and every allowance of this user, with `limit: null` for unlimited. */
    async snapshot(userId: string): Promise<UsageResponse> {
      const at = now();
      const { plan, amounts } = await repo.snapshot(userId, startsAt(at), at);
      const admin = await options.isAdmin(userId);
      const usage = Object.fromEntries(
        USAGE_METRICS.map((m) => [
          m,
          itemOf(m, amounts[m], admin ? null : options.limits[plan][m], at),
        ]),
      ) as UsageResponse['usage'];
      return { plan, usage };
    },

    /** The single place `ADMIN_EMAILS` is read. A long-lived caller (a socket) asks once and passes `admin` on. */
    isAdmin: options.isAdmin,

    /**
     * Read-only check, for gates that count later (translation time). Never throws. One query by primary key;
     * `admin` skips the email lookup when the caller already knows it.
     */
    async status(
      userId: string,
      metric: UsageMetric,
      known: { admin?: boolean } = {},
    ): Promise<UsageItem> {
      const at = now();
      const { used, limit } = await gateOf(userId, metric, at, known.admin);
      return itemOf(metric, used, limit, at);
    },

    /** Same as {@link tryReserve} but throws 429 `QUOTA_EXCEEDED` with the allowance in `details`. */
    async reserve(userId: string, metric: UsageMetric, amount = 1): Promise<UsageItem> {
      const result = await tryReserve(userId, metric, amount);
      if (!result.ok) {
        throw new AppError(ErrorCode.QuotaExceeded, 'Usage allowance used up', result.details);
      }
      return result.item;
    },

    /**
     * Counts time already spent; may pass the limit by one segment (spec Q5). One write: the caller passes the
     * `limit` its last `status` returned, so nothing is looked up again.
     */
    async add(
      userId: string,
      metric: UsageMetric,
      amount: number,
      limit: number | null,
    ): Promise<UsageItem> {
      const at = now();
      const total = await repo.add(userId, metric, periodStart(metric, at), amount);
      return itemOf(metric, total, limit, at);
    },

    /** AC2: admin picks the person by email; the plan applies from the next check. */
    async setPlan(
      adminId: string,
      email: string,
      plan: Plan,
      expiresAt?: string,
    ): Promise<SetPlanResponse> {
      if (!(await options.isAdmin(adminId))) {
        throw new AppError(ErrorCode.Forbidden, 'Admin access required');
      }
      // An end date only means something for a paid plan, and it must still be ahead.
      const end = plan === 'free' || !expiresAt ? null : new Date(expiresAt);
      if (end && end.getTime() <= now().getTime()) {
        throw new AppError(ErrorCode.Validation, 'expiresAt must be in the future');
      }
      const target = await repo.userIdByEmail(email);
      if (!target) throw new AppError(ErrorCode.NotFound, 'No user has this email');
      await repo.setPlan(target, plan, adminId, end);
      return end ? { email, plan, expiresAt: end.toISOString() } : { email, plan };
    },
  };
}
