import type { AdminUserRow } from '@cuelingo/shared';
import { formatDateVn } from '@cuelingo/ui/lib/usage';

/** Where the plan row came from. */
export function sourceLabel(source: AdminUserRow['source']): string {
  if (source === 'payment') return 'Thanh toán';
  if (source === 'manual') return 'Gán tay';
  return '—';
}

/**
 * The end date column. A plan that has ended reads Free, so the old date is shown as "Hết hạn ..." to tell it
 * from a Free account that never paid.
 */
export function expiryText(row: Pick<AdminUserRow, 'plan' | 'expiresAt'>): string {
  if (!row.expiresAt) return row.plan === 'free' ? '—' : 'Không hết hạn';
  const date = formatDateVn(row.expiresAt);
  return row.plan === 'free' ? `Hết hạn ${date}` : date;
}

export const isAuthRefusal = (status: number) => status === 401 || status === 403;
