import type { UsageResponse } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UsagePanelView } from './UsagePanel';

const HOUR = 3_600_000;
const resetsAt = '2026-11-30T17:00:00.000Z';

const usage: UsageResponse = {
  plan: 'free',
  usage: {
    translation_ms: { used: HOUR, limit: 2 * HOUR, resetsAt, state: 'ok' },
    cloud_stt_ms: { used: HOUR - 300_000, limit: HOUR, resetsAt, state: 'low' },
    debriefs: { used: 8, limit: 8, resetsAt, state: 'exhausted' },
    assist_daily: { used: 0, limit: null, resetsAt, state: 'ok' },
    agent_messages: { used: 0, limit: 0, resetsAt, state: 'exhausted' },
  },
};

describe('UsagePanelView', () => {
  it('shows the plan name and a meter for each of the five allowances', () => {
    const markup = renderToStaticMarkup(
      <UsagePanelView usage={usage} loading={false} error={null} />,
    );
    expect(markup).toContain('Gói hiện tại: <strong>Free</strong>');
    for (const label of [
      'Giờ dịch',
      'Nhận dạng giọng nói đám mây',
      'Debrief sau họp',
      'Tra từ và nói giúp hôm nay',
      'Tin nhắn trợ lý',
    ]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain('Còn 1 giờ');
    expect(markup).toContain('Còn 5 phút');
    expect(markup).toContain('Đã hết');
    expect(markup).toContain('Không giới hạn');
    expect(markup).toContain('Không có trong gói này');
    expect(markup.match(/data-state="low"/g)).toHaveLength(1);
  });

  it('shows loading and error states', () => {
    expect(renderToStaticMarkup(<UsagePanelView loading error={null} />)).toContain(
      'Đang tải lượng dùng',
    );
    expect(
      renderToStaticMarkup(
        <UsagePanelView loading={false} error="Không kết nối được tới máy chủ" />,
      ),
    ).toContain('Không kết nối được tới máy chủ');
  });
});
