import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { formatDurationMs, formatRemaining, usageFraction, usageLabel } from '../lib/usage';
import { UsageMeter, UsageSummary } from './usage-meter';

const HOUR = 3_600_000;
const MIN = 60_000;

describe('usage formatting', () => {
  it('formats durations rounding down', () => {
    expect(formatDurationMs(2 * HOUR)).toBe('2 giờ');
    expect(formatDurationMs(HOUR + 5 * MIN + 59_000)).toBe('1 giờ 5 phút');
    expect(formatDurationMs(35 * MIN)).toBe('35 phút');
    expect(formatDurationMs(30_000)).toBe('dưới 1 phút');
  });

  it('says what is left per unit', () => {
    expect(formatRemaining('translation_ms', HOUR, 2 * HOUR)).toBe('Còn 1 giờ');
    expect(formatRemaining('debriefs', 5, 8)).toBe('Còn 3 lần');
    expect(formatRemaining('debriefs', 8, 8)).toBe('Đã hết');
    expect(formatRemaining('debriefs', 99, null)).toBe('Không giới hạn');
    expect(formatRemaining('agent_messages', 0, 0)).toBe('Không có trong gói này');
  });

  it('clamps the fraction', () => {
    expect(usageFraction(5, 10)).toBe(0.5);
    expect(usageFraction(20, 10)).toBe(1);
    expect(usageFraction(5, null)).toBe(0);
  });

  it('has a Vietnamese label per metric', () => {
    expect(usageLabel('translation_ms')).toBe('Giờ dịch');
  });
});

describe('UsageMeter', () => {
  it('shows the label, a progress bar and what is left', () => {
    const html = renderToStaticMarkup(
      <UsageMeter
        metric="translation_ms"
        used={HOUR}
        limit={2 * HOUR}
        state="ok"
        resetsAt="2026-11-30T17:00:00.000Z"
      />,
    );
    expect(html).toContain('Giờ dịch');
    expect(html).toContain('Còn 1 giờ');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="50"');
    expect(html).toContain('Làm mới ngày 1/12/2026');
  });

  it('marks low and exhausted states with their own colour', () => {
    const low = renderToStaticMarkup(
      <UsageMeter metric="debriefs" used={7} limit={8} state="low" />,
    );
    const out = renderToStaticMarkup(
      <UsageMeter metric="debriefs" used={8} limit={8} state="exhausted" />,
    );
    expect(low).toContain('data-state="low"');
    expect(low).toContain('amber');
    expect(out).toContain('data-state="exhausted"');
    expect(out).toContain('bg-destructive');
    expect(out).toContain('Đã hết');
  });

  it('shows "Không giới hạn" without a bar when unlimited', () => {
    const html = renderToStaticMarkup(
      <UsageMeter metric="assist_daily" used={50} limit={null} state="ok" />,
    );
    expect(html).toContain('Không giới hạn');
    expect(html).not.toContain('progressbar');
  });
});

describe('UsageSummary', () => {
  it('shows the plan and a meter per metric it has', () => {
    const html = renderToStaticMarkup(
      <UsageSummary
        plan="pro"
        usage={{
          translation_ms: { used: 0, limit: 20 * HOUR, state: 'ok' },
          debriefs: { used: 0, limit: null, state: 'ok' },
        }}
      />,
    );
    expect(html).toContain('<strong>Pro</strong>');
    expect(html).toContain('Giờ dịch');
    expect(html).toContain('Debrief sau họp');
    expect(html).not.toContain('Tin nhắn trợ lý');
  });
});
