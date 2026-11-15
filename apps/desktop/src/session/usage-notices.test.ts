import { describe, expect, it } from 'vitest';
import { isMeetingMetric, usageNotice } from './usage-notices';

const MIN = 60_000;

describe('usageNotice', () => {
  it('warns how many minutes of translation are left', () => {
    expect(
      usageNotice('translation_ms', {
        used: 1_000 * MIN - 8 * MIN,
        limit: 1_000 * MIN,
        state: 'low',
      }),
    ).toEqual({
      id: 'usage:translation_ms:low',
      tone: 'warning',
      text: 'Còn khoảng 8 phút dịch tháng này',
    });
  });

  it('rounds a last few seconds down to "dưới 1 phút"', () => {
    expect(
      usageNotice('translation_ms', { used: 100 * MIN - 20_000, limit: 100 * MIN, state: 'low' })
        ?.text,
    ).toBe('Còn dưới 1 phút dịch tháng này');
  });

  it('says English captions keep running when translation is used up', () => {
    expect(usageNotice('translation_ms', { used: 5, limit: 5, state: 'exhausted' })).toEqual({
      id: 'usage:translation_ms:exhausted',
      tone: 'error',
      text: 'Đã hết giờ dịch tháng này, caption tiếng Anh vẫn chạy',
    });
  });

  it('counts the remaining debriefs', () => {
    expect(usageNotice('debriefs', { used: 7, limit: 8, state: 'low' })?.text).toBe(
      'Còn 1 lần debrief tháng này',
    );
  });

  it('is silent when fine, unlimited, or not a meeting allowance', () => {
    expect(usageNotice('debriefs', { used: 1, limit: 8, state: 'ok' })).toBeNull();
    expect(usageNotice('debriefs', { used: 1, limit: null, state: 'low' })).toBeNull();
    expect(usageNotice('agent_messages', { used: 0, limit: 0, state: 'exhausted' })).toBeNull();
    expect(isMeetingMetric('agent_messages')).toBe(false);
  });
});
