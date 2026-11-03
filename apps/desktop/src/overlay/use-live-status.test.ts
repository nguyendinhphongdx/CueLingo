import { describe, expect, it } from 'vitest';
import type { TranscriptEvent } from '../lib/native';
import { activeWindowMs } from './use-live-status';

const segment = (language?: string): TranscriptEvent => ({
  segmentId: 's1',
  text: 'hello',
  translation: null,
  partial: false,
  language,
});

describe('activeWindowMs', () => {
  it('uses the short window for on-device recognition', () => {
    expect(activeWindowMs([segment('en')])).toBe(6_000);
    expect(activeWindowMs([segment()])).toBe(6_000);
    expect(activeWindowMs([])).toBe(6_000);
  });

  it('waits longer for a language that is recognised in the cloud', () => {
    expect(activeWindowMs([segment('en'), segment('vi')])).toBe(25_000);
  });
});
