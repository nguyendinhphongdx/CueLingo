import { formatDurationMs, isDurationMetric } from '@cuelingo/ui/lib/usage';

export const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

/** `2026-11-05` → `05/11`. */
export const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
/** `2026-11` → `11/2026`. */
export const monthLabel = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`;
export const percent = (ratio: number | null) =>
  ratio === null ? null : `${number.format(ratio * 100)}%`;

/** A total or mean of a usage metric: hours/minutes for the time metrics, a count for the others. */
export const usageAmount = (metric: string, amount: number) =>
  isDurationMetric(metric) ? formatDurationMs(Math.round(amount)) : `${number.format(amount)} lần`;

export const ORDER_STATUS_LABEL = {
  pending: 'Đang chờ',
  paid: 'Đã trả',
  expired: 'Hết hạn',
  cancelled: 'Đã huỷ',
} as const;

/** `Cập nhật lúc 14:05 · Số liệu làm mới mỗi phút`. */
export const generatedAtText = (iso: string) =>
  `Cập nhật lúc ${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(iso))} · Số liệu làm mới mỗi phút`;
