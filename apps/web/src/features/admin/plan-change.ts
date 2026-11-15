import type { AdminUserRow, Plan } from '@cuelingo/shared';
import { formatDateVn } from '@cuelingo/ui/lib/usage';

const RANK: Record<Plan, number> = { free: 0, pro: 1, ultra: 2 };

/**
 * The end date typed in the form ("2026-12-31") as the instant the plan ends: the end of that day in Vietnam
 * (G5). Free has no end, and an empty date means the plan never ends.
 */
export function expiresAtFor(plan: Plan, date: string): string | undefined {
  if (plan === 'free' || !date) return undefined;
  const end = new Date(`${date}T23:59:59.999+07:00`);
  return Number.isNaN(end.getTime()) ? undefined : end.toISOString();
}

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
