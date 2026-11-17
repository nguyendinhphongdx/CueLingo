import type { UsageResponse } from '@cuelingo/shared';
import { formatDurationMs, formatResetDate, usageFraction } from '@cuelingo/ui/lib/usage';

/** The allowances a meeting depends on; others (agent messages, assist) have their own places. */
const HOME_METRICS = ['translation_ms', 'debriefs'] as const;
type HomeMetric = (typeof HOME_METRICS)[number];

/** From this share of an allowance the Phiên họp page warns; at 100% it says what still works. */
export const USAGE_WARN_FRACTION = 0.8;

export interface UsageNoticeData {
  metric: HomeMetric;
  exhausted: boolean;
  /** Vietnamese headline: what is left, or what ran out. */
  title: string;
  /** What still works (only when exhausted). */
  detail?: string;
}

function left(metric: HomeMetric, remaining: number): string {
  return metric === 'translation_ms'
    ? `Còn khoảng ${formatDurationMs(remaining)} dịch tháng này.`
    : `Còn ${remaining} lần debrief tháng này.`;
}

function exhaustedNotice(metric: HomeMetric, resetsAt: string | undefined): UsageNoticeData {
  const date = resetsAt ? formatResetDate(resetsAt) : '';
  const again = date ? `vào ${date}` : 'khi hạn mức làm mới';
  return metric === 'translation_ms'
    ? {
        metric,
        exhausted: true,
        title: 'Hết giờ dịch tháng này',
        detail: `Caption gốc vẫn chạy. Bản dịch tiếng Việt chạy lại ${again} hoặc khi bạn nâng cấp.`,
      }
    : {
        metric,
        exhausted: true,
        title: 'Hết lượt debrief tháng này',
        detail: `Caption và bản dịch vẫn chạy, nhưng cuộc họp mới sẽ chưa có debrief. Lượt mới ${again} hoặc khi bạn nâng cấp.`,
      };
}

/**
 * The one notice the home page shows: an allowance used up first, otherwise the fullest one from 80%.
 * Unlimited allowances and plans without one (limit 0) never warn.
 */
export function pickUsageNotice(usage: UsageResponse['usage'] | undefined): UsageNoticeData | null {
  if (!usage) return null;
  let best: { metric: HomeMetric; fraction: number; remaining: number } | null = null;
  for (const metric of HOME_METRICS) {
    const item = usage[metric];
    if (!item || item.limit === null || item.limit === 0) continue;
    if (item.used >= item.limit) return exhaustedNotice(metric, item.resetsAt);
    const fraction = usageFraction(item.used, item.limit);
    if (fraction >= USAGE_WARN_FRACTION && (!best || fraction > best.fraction)) {
      best = { metric, fraction, remaining: item.limit - item.used };
    }
  }
  return best
    ? {
        metric: best.metric,
        exhausted: false,
        title: left(best.metric, best.remaining),
      }
    : null;
}
