import { SUPPORTED_LANGUAGES } from '@cuelingo/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pickUpcoming, startsIn } from './calendar-hint';

const NOW = 1_000_000_000_000;
const event = (patch: Partial<Parameters<typeof pickUpcoming>[0][number]> = {}) => ({
  title: '日本チームと定例',
  startMs: NOW + 5 * 60_000,
  endMs: NOW + 35 * 60_000,
  location: '',
  attendeeDomains: [],
  ...patch,
});

describe('language switch', () => {
  it('offers no switch for an ordinary English meeting', () => {
    expect(pickUpcoming([event({ title: 'Weekly sync' })], NOW, 'en', new Set())).toMatchObject({
      switchTo: null,
    });
  });

  describe('with Japanese switched on', () => {
    // The registry is static, so switch it on for these tests only.
    const japanese = SUPPORTED_LANGUAGES.ja as { enabled: boolean };
    beforeEach(() => {
      japanese.enabled = true;
    });
    afterEach(() => {
      japanese.enabled = false;
    });

    it('points to the language of a meeting about to start', () => {
      expect(pickUpcoming([event()], NOW, 'en', new Set())).toMatchObject({ switchTo: 'ja' });
    });

    it('does not switch when the meeting is already in that language', () => {
      expect(pickUpcoming([event()], NOW, 'ja', new Set())).toMatchObject({ switchTo: null });
    });
  });
});

describe('pickUpcoming', () => {
  it('offers any meeting that starts within 15 minutes, with no language switch for English', () => {
    const hint = pickUpcoming([event({ title: 'Weekly sync' })], NOW, 'en', new Set());
    expect(hint).toMatchObject({ title: 'Weekly sync', switchTo: null });
  });

  it('ignores far, over and skipped meetings', () => {
    const far = event({ title: 'Later', startMs: NOW + 3_600_000, endMs: NOW + 4_000_000 });
    const over = event({ title: 'Done', startMs: NOW - 3_600_000, endMs: NOW - 60_000 });
    expect(pickUpcoming([far, over], NOW, 'en', new Set())).toBeNull();
    const e = event({ title: 'Sync' });
    expect(pickUpcoming([e], NOW, 'en', new Set([`${e.startMs}:${e.title}`]))).toBeNull();
  });

  it('says how long is left', () => {
    expect(startsIn(NOW + 10 * 60_000, NOW)).toBe('Còn 10 phút');
    expect(startsIn(NOW - 1, NOW)).toBe('Đang diễn ra');
  });
});
