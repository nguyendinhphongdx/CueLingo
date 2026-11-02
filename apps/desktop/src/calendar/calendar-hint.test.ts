import { SUPPORTED_LANGUAGES } from '@cuelingo/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pickHint } from './calendar-hint';

const NOW = 1_000_000_000_000;
const event = (patch: Partial<Parameters<typeof pickHint>[0][number]> = {}) => ({
  title: '日本チームと定例',
  startMs: NOW + 5 * 60_000,
  endMs: NOW + 35 * 60_000,
  location: '',
  attendeeDomains: [],
  ...patch,
});

describe('pickHint', () => {
  it('suggests nothing while no language besides English is switched on', () => {
    expect(pickHint([event()], NOW, 'en', new Set())).toBeNull();
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

    it('offers the language of a meeting about to start', () => {
      expect(pickHint([event()], NOW, 'en', new Set())).toMatchObject({ language: 'ja' });
    });

    it('ignores meetings that are far off, over, already in that language or dismissed', () => {
      const far = event({ startMs: NOW + 3_600_000, endMs: NOW + 4_000_000 });
      const over = event({ startMs: NOW - 3_600_000, endMs: NOW - 60_000 });
      expect(pickHint([far, over], NOW, 'en', new Set())).toBeNull();
      expect(pickHint([event()], NOW, 'ja', new Set())).toBeNull();
      const key = `${event().startMs}:${event().title}`;
      expect(pickHint([event()], NOW, 'en', new Set([key]))).toBeNull();
    });
  });
});
