import {
  DEFAULT_PLAN_PRICES,
  planAfterAdminGrant,
  type AdminUserRow,
  type BillingPeriod,
  type Plan,
  type PlanRow,
} from '@cuelingo/shared';
import { formatDateVn } from '@cuelingo/ui/lib/usage';

const RANK: Record<Plan, number> = { free: 0, pro: 1, ultra: 2 };

/** AC6: the warning when a plan someone PAID for, and which is still in force, is lowered. Null otherwise (G6). */
export function planChangeWarning(
  user: Pick<AdminUserRow, 'plan' | 'source' | 'expiresAt'>,
  target: Plan,
  now: Date,
): string | null {
  if (user.source !== 'payment' || user.plan === 'free' || !user.expiresAt) return null;
  if (new Date(user.expiresAt).getTime() <= now.getTime()) return null;
  if (RANK[target] >= RANK[user.plan]) return null;
  return `Người này đã trả tiền đến ${formatDateVn(user.expiresAt)}. Hạ gói không hoàn tiền; hoàn tiền (nếu cần) làm tay ngoài hệ thống.`;
}

/**
 * Where the plan would end if the admin saved now: the same shared function the server uses, fed the person's
 * stored plan. Prices are the defaults; they only matter when a Pro person goes up to Ultra, and only the
 * server's `PLAN_PRICES` can differ, so the form calls this "dự kiến" and the exact date comes back after saving.
 * Null for Free (no end date).
 */
export function previewExpiresAt(
  user: Pick<AdminUserRow, 'plan' | 'source' | 'expiresAt'>,
  plan: Plan,
  period: BillingPeriod,
  now: Date,
): string | null {
  const current: PlanRow | null =
    user.source === null
      ? null
      : {
          plan: user.plan,
          expiresAt: user.expiresAt ? new Date(user.expiresAt) : null,
          source: user.source,
        };
  const outcome = planAfterAdminGrant({
    current,
    now,
    plan,
    period: plan === 'free' ? undefined : period,
    prices: DEFAULT_PLAN_PRICES,
  });
  return outcome.expiresAt ? outcome.expiresAt.toISOString() : null;
}
