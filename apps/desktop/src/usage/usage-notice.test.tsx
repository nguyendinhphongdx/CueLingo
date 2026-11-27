import type { UsageResponse } from '@cuelingo/shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { pickUsageNotice } from './usage-notice';
import { UsageNoticeView } from './UsageNotice';

const resetsAt = '2026-11-30T17:00:00.000Z';
const HOUR = 3_600_000;
const usage = (
  translation: [number, number | null],
  debriefs: [number, number | null] = [0, null],
): UsageResponse['usage'] => ({
  translation_ms: { used: translation[0], limit: translation[1], resetsAt, state: 'ok' },
  cloud_stt_ms: { used: 0, limit: null, resetsAt, state: 'ok' },
  debriefs: { used: debriefs[0], limit: debriefs[1], resetsAt, state: 'ok' },
  assist_daily: { used: 0, limit: null, resetsAt, state: 'ok' },
  agent_messages: { used: 0, limit: null, resetsAt, state: 'ok' },
  lessons_daily: { used: 0, limit: null, resetsAt, state: 'ok' },
  lesson_practice_daily: { used: 0, limit: null, resetsAt, state: 'ok' },
  meeting_ask_daily: { used: 0, limit: null, resetsAt, state: 'ok' },
});

describe('usage notice on the meeting page', () => {
  it('shows nothing below 80% or for unlimited allowances', () => {
    expect(pickUsageNotice(usage([7 * HOUR, 10 * HOUR]))).toBeNull();
    expect(pickUsageNotice(usage([100 * HOUR, null]))).toBeNull();
    expect(pickUsageNotice(undefined)).toBeNull();
  });

  it('warns from 80% with what is left and no upgrade button', () => {
    const notice = pickUsageNotice(usage([8 * HOUR, 10 * HOUR]))!;
    expect(notice.exhausted).toBe(false);
    const markup = renderToStaticMarkup(<UsageNoticeView notice={notice} onUpgrade={() => {}} />);
    expect(markup).toContain('Còn khoảng 2 giờ dịch tháng này');
    expect(markup).not.toContain('Nâng cấp');
  });

  it('at 100% says what still works and offers the upgrade', () => {
    const notice = pickUsageNotice(usage([10 * HOUR, 10 * HOUR]))!;
    expect(notice.exhausted).toBe(true);
    const markup = renderToStaticMarkup(<UsageNoticeView notice={notice} onUpgrade={() => {}} />);
    expect(markup).toContain('Hết giờ dịch tháng này');
    expect(markup).toContain('Caption gốc vẫn chạy');
    expect(markup).toContain('Nâng cấp');
  });

  it('hides the upgrade button when payments are off', () => {
    const notice = pickUsageNotice(usage([10 * HOUR, 10 * HOUR]))!;
    expect(renderToStaticMarkup(<UsageNoticeView notice={notice} />)).not.toContain('Nâng cấp');
  });

  it('warns about debriefs and puts an used-up allowance before a fuller-looking one', () => {
    const debrief = pickUsageNotice(usage([0, 10 * HOUR], [4, 5]))!;
    expect(debrief.metric).toBe('debriefs');
    expect(debrief.title).toBe('Còn 1 lần debrief tháng này.');
    const both = pickUsageNotice(usage([9 * HOUR, 10 * HOUR], [3, 3]))!;
    expect(both.exhausted).toBe(true);
    expect(both.metric).toBe('debriefs');
  });
});
