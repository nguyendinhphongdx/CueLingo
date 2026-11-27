import type { UsageResponse } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { canUpgrade, UPGRADE_PATH } from './upgrade';
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
    lessons_daily: { used: 0, limit: 10, resetsAt, state: 'ok' },
    lesson_practice_daily: { used: 0, limit: 150, resetsAt, state: 'ok' },
    meeting_ask_daily: { used: 0, limit: 150, resetsAt, state: 'ok' },
  },
};

describe('UsagePanelView', () => {
  it('shows the plan and a meter for every allowance', () => {
    const markup = renderToStaticMarkup(
      <UsagePanelView usage={usage} loading={false} error={null} />,
    );
    expect(markup).toContain('<strong>Pro</strong>');
    expect(markup.match(/data-state=/g)).toHaveLength(8);
    expect(markup).toContain('Còn 19 giờ');
    expect(markup).toContain('Còn 1 lần');
  });

  it('shows loading and error', () => {
    expect(renderToStaticMarkup(<UsagePanelView loading error={null} />)).toContain('Đang tải');
    expect(renderToStaticMarkup(<UsagePanelView loading={false} error="Lỗi" />)).toContain('Lỗi');
  });
});

describe('upgrade button', () => {
  it('shows "Nâng gói" only when an upgrade handler is given', () => {
    const on = renderToStaticMarkup(
      <UsagePanelView usage={usage} loading={false} error={null} onUpgrade={() => {}} />,
    );
    const off = renderToStaticMarkup(<UsagePanelView usage={usage} loading={false} error={null} />);
    expect(on).toContain('Nâng gói');
    expect(off).not.toContain('Nâng gói');
  });

  it('reminds when the paid plan ends within 3 days', () => {
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const markup = renderToStaticMarkup(
      <UsagePanelView usage={usage} loading={false} error={null} planExpiresAt={soon} />,
    );
    expect(markup).toContain('Gói Pro hết hạn ngày');
    const far = new Date(Date.now() + 20 * 86_400_000).toISOString();
    expect(
      renderToStaticMarkup(
        <UsagePanelView usage={usage} loading={false} error={null} planExpiresAt={far} />,
      ),
    ).not.toContain('hết hạn ngày');
  });
});

describe('canUpgrade', () => {
  const overview = (enabled: boolean, offers: number) =>
    ({
      enabled,
      current: { plan: 'free', expiresAt: null, source: null },
      offers: Array.from({ length: offers }, () => ({})),
    }) as never;

  it('is false while loading, when payments are off, or when nothing is left to buy', () => {
    expect(canUpgrade(undefined)).toBe(false);
    expect(canUpgrade(overview(false, 0))).toBe(false);
    expect(canUpgrade(overview(true, 0))).toBe(false);
    expect(canUpgrade(overview(true, 2))).toBe(true);
  });

  it('opens the web upgrade page, never carrying a token', () => {
    expect(UPGRADE_PATH).toBe('/upgrade');
  });
});
