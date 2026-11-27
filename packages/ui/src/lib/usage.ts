/** Vietnamese wording for plan allowances. Structural types: this package does not import `shared`. */

export type UsageState = 'ok' | 'low' | 'exhausted';

const LABELS: Record<string, string> = {
  translation_ms: 'Giờ dịch',
  cloud_stt_ms: 'Nhận dạng giọng nói đám mây',
  debriefs: 'Debrief sau họp',
  assist_daily: 'Tra từ và nói giúp hôm nay',
  agent_messages: 'Tin nhắn trợ lý',
  lessons_daily: 'Bài học mới hôm nay',
  lesson_practice_daily: 'Câu luyện được góp ý hôm nay',
  meeting_ask_daily: 'Câu hỏi trợ lý trong họp hôm nay',
};

/** The order allowances are listed in. */
export const USAGE_METRIC_ORDER = [
  'translation_ms',
  'cloud_stt_ms',
  'debriefs',
  'assist_daily',
  'agent_messages',
  'lessons_daily',
  'lesson_practice_daily',
  'meeting_ask_daily',
] as const;

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

/** "99.000 ₫": whole dong with dots between thousands, the way prices are written in Vietnam. */
export function formatVnd(amount: number): string {
  return `${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ₫`;
}

/** "05/12/2026" (day/month/year, zero padded) in Vietnam time; empty for a value that is not a date. */
export function formatDateVn(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

/** How long before a paid plan ends the person is reminded. */
export const PLAN_EXPIRY_NOTICE_DAYS = 3;

/**
 * "Gói Pro hết hạn ngày 05/12/2026" when a paid plan ends within {@link PLAN_EXPIRY_NOTICE_DAYS} days, else null
 * (no end date, not near, or already over: the server then applies Free by itself).
 */
export function planExpiryNotice(
  plan: string,
  expiresAt: string | null | undefined,
  now: Date,
): string | null {
  if (!expiresAt || plan === 'free') return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  const left = end - now.getTime();
  if (left <= 0 || left > PLAN_EXPIRY_NOTICE_DAYS * 86_400_000) return null;
  return `Gói ${planName(plan)} hết hạn ngày ${formatDateVn(expiresAt)}`;
}

const DAILY_METRICS = new Set([
  'assist_daily',
  'lessons_daily',
  'lesson_practice_daily',
  'meeting_ask_daily',
]);

/** What the person is told when a call is refused for lack of allowance. Never retried. */
export function quotaExceededMessage(metric: string, resetsAt?: string): string {
  const what: Record<string, string> = {
    translation_ms: 'giờ dịch tháng này',
    cloud_stt_ms: 'giờ nhận dạng giọng nói đám mây tháng này',
    debriefs: 'lượt debrief tháng này',
    assist_daily: 'lượt tra từ và nói giúp hôm nay',
    agent_messages: 'tin nhắn trợ lý tháng này',
    lessons_daily: 'lượt mở bài học mới hôm nay',
    lesson_practice_daily: 'lượt góp ý câu luyện hôm nay',
    meeting_ask_daily: 'lượt hỏi trợ lý trong họp hôm nay',
  };
  const head = `Bạn đã dùng hết ${what[metric] ?? 'hạn mức của gói'}.`;
  const date = resetsAt ? formatResetDate(resetsAt) : '';
  if (DAILY_METRICS.has(metric)) return `${head} Ngày mai sẽ được làm mới.`;
  return date ? `${head} Hạn mức được làm mới ngày ${date}.` : head;
}
