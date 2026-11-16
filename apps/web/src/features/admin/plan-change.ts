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

/**
 * The stored end date as the day the form shows ("2026-12-31", the day in Vietnam). `expiresAtFor` turns it back
 * into the end of that day, so saving an unchanged plan keeps its end date. Free or no date: empty.
 */
export function dateInputFor(user: Pick<AdminUserRow, 'plan' | 'expiresAt'>): string {
  if (user.plan === 'free' || !user.expiresAt) return '';
  const end = new Date(user.expiresAt);
  if (Number.isNaN(end.getTime())) return '';
  // Vietnam is UTC+7 with no daylight saving; the `sv-SE` locale writes YYYY-MM-DD.
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(end);
}

/**
 * The end date to send. Left as it was prefilled, the exact stored instant goes back (a paid plan ends at the
 * time of day it was bought for, not at the end of that day); a day the admin picked means the end of that day.
 */
export function expiresAtToSend(
  user: Pick<AdminUserRow, 'plan' | 'expiresAt'>,
  plan: Plan,
  date: string,
): string | undefined {
  if (plan !== 'free' && user.expiresAt && date !== '' && date === dateInputFor(user)) {
    return user.expiresAt;
  }
  return expiresAtFor(plan, date);
}
