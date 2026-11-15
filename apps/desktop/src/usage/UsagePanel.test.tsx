import type { UsageResponse } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UsagePanelView } from './UsagePanelView';

const resetsAt = '2026-11-30T17:00:00.000Z';
const usage: UsageResponse = {
  plan: 'pro',
  usage: {
    translation_ms: { used: 3_600_000, limit: 72_000_000, resetsAt, state: 'ok' },
    cloud_stt_ms: { used: 0, limit: 36_000_000, resetsAt, state: 'ok' },
    debriefs: { used: 0, limit: null, resetsAt, state: 'ok' },
    assist_daily: { used: 0, limit: null, resetsAt, state: 'ok' },
    agent_messages: { used: 99, limit: 100, resetsAt, state: 'low' },
  },
};

describe('UsagePanelView', () => {
  it('shows the plan and a meter for every allowance', () => {
    const markup = renderToStaticMarkup(
      <UsagePanelView usage={usage} loading={false} error={null} />,
    );
    expect(markup).toContain('<strong>Pro</strong>');
    expect(markup.match(/data-state=/g)).toHaveLength(5);
    expect(markup).toContain('Còn 19 giờ');
    expect(markup).toContain('Còn 1 lần');
  });

  it('shows loading and error', () => {
    expect(renderToStaticMarkup(<UsagePanelView loading error={null} />)).toContain('Đang tải');
    expect(renderToStaticMarkup(<UsagePanelView loading={false} error="Lỗi" />)).toContain('Lỗi');
  });
});
