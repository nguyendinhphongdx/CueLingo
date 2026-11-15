import { formatDurationMs, formatUsageAmount } from '@cuelingo/ui/lib/usage';
import type { NoticeEvent } from '../lib/native';

/** The part of a usage item a notice needs. Structural so it fits both the REST body and the WebSocket message. */
interface UsageLike {
  used: number;
  limit: number | null;
  state: 'ok' | 'low' | 'exhausted';
}

/** Allowances that matter during a meeting. `agent_messages` is not one: Free has none and would warn every time. */
const MEETING_METRICS = ['translation_ms', 'cloud_stt_ms', 'debriefs', 'assist_daily'] as const;
export type MeetingMetric = (typeof MEETING_METRICS)[number];

export const isMeetingMetric = (metric: string): metric is MeetingMetric =>
  (MEETING_METRICS as readonly string[]).includes(metric);

const EXHAUSTED_TEXT: Record<MeetingMetric, string> = {
  translation_ms: 'Đã hết giờ dịch tháng này, caption tiếng Anh vẫn chạy',
  cloud_stt_ms:
    'Đã hết giờ nhận dạng giọng nói đám mây tháng này, CueLingo dừng gửi âm thanh lên đám mây',
  debriefs: 'Đã hết lượt debrief tháng này, cuộc họp này sẽ không có debrief',
  assist_daily: 'Đã hết lượt tra từ và nói giúp hôm nay',
};

function remainingTime(ms: number): string {
  return ms < 60_000 ? 'Còn dưới 1 phút' : `Còn khoảng ${formatDurationMs(ms)}`;
}

/** "Còn khoảng 8 phút dịch tháng này"; counts say "Còn 2 lần debrief tháng này". */
function lowText(metric: MeetingMetric, left: number): string {
  switch (metric) {
    case 'translation_ms':
      return `${remainingTime(left)} dịch tháng này`;
    case 'cloud_stt_ms':
      return `${remainingTime(left)} nhận dạng đám mây tháng này`;
    case 'debriefs':
      return `Còn ${formatUsageAmount(metric, left)} debrief tháng này`;
    case 'assist_daily':
      return `Còn ${formatUsageAmount(metric, left)} tra từ và nói giúp hôm nay`;
  }
}

/** The notice for an allowance that is low or used up; null when it is fine, unlimited or not a meeting one. */
export function usageNotice(metric: string, item: UsageLike): NoticeEvent | null {
  if (!isMeetingMetric(metric) || item.state === 'ok' || item.limit === null) return null;
  if (item.state === 'exhausted')
    return { id: `usage:${metric}:exhausted`, tone: 'error', text: EXHAUSTED_TEXT[metric] };
  const left = Math.max(0, item.limit - item.used);
  return { id: `usage:${metric}:low`, tone: 'warning', text: lowText(metric, left) };
}
