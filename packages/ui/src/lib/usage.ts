/** Vietnamese wording for plan allowances. Structural types: this package does not import `shared`. */

export type UsageState = 'ok' | 'low' | 'exhausted';

const LABELS: Record<string, string> = {
  translation_ms: 'Giờ dịch',
  cloud_stt_ms: 'Nhận dạng giọng nói đám mây',
  debriefs: 'Debrief sau họp',
  assist_daily: 'Tra từ và nói giúp hôm nay',
  agent_messages: 'Tin nhắn trợ lý',
};

const PLAN_NAMES: Record<string, string> = { free: 'Free', pro: 'Pro', ultra: 'Ultra' };

export function usageLabel(metric: string): string {
  return LABELS[metric] ?? metric;
}

export function planName(plan: string): string {
  return PLAN_NAMES[plan] ?? plan;
}

/** `*_ms` metrics are milliseconds of audio; the others are counts. */
export function isDurationMetric(metric: string): boolean {
  return metric.endsWith('_ms');
}

/** "2 giờ 5 phút", "35 phút" or "dưới 1 phút". Rounds down so we never promise time that is not left. */
export function formatDurationMs(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return 'dưới 1 phút';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} phút`;
  return rest === 0 ? `${hours} giờ` : `${hours} giờ ${rest} phút`;
}

/** The amount in the unit of its metric, without the word "còn". */
export function formatUsageAmount(metric: string, amount: number): string {
  return isDurationMetric(metric) ? formatDurationMs(amount) : `${amount} lần`;
}

/** "Còn 35 phút", "Còn 3 lần", "Đã hết", "Không giới hạn" or "Không có trong gói này". */
export function formatRemaining(metric: string, used: number, limit: number | null): string {
  if (limit === null) return 'Không giới hạn';
  if (limit === 0) return 'Không có trong gói này';
  const left = Math.max(0, limit - used);
  if (left === 0) return 'Đã hết';
  return `Còn ${formatUsageAmount(metric, left)}`;
}

/** Share of the allowance used, 0..1. Unlimited counts as 0. */
export function usageFraction(used: number, limit: number | null): number {
  if (limit === null) return 0;
  if (limit === 0) return 1;
  return Math.min(1, Math.max(0, used / limit));
}

/** "1/12/2026" style date of the next reset, in Vietnam time. */
export function formatResetDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}
