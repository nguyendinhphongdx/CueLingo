import { describe, expect, it } from 'vitest';
import type { TranscriptEvent } from '../lib/native';
import { selectRecentSystemSentences, updateTranscriptEvents } from './transcript-store';

const event = (segmentId: string, partial = false): TranscriptEvent => ({
  segmentId,
  text: `Text ${segmentId}`,
  translation: `Bản dịch ${segmentId}`,
  partial,
});

describe('transcript store', () => {
  it('replaces a segment with the same id instead of duplicating it', () => {
    const partial = event('same', true);
    const final = { ...event('same'), text: 'Final text' };
    const result = updateTranscriptEvents([partial], final);

    expect(result).toEqual([final]);
  });

  it('keeps up to fifteen recent segments for Quick Assist', () => {
    const result = Array.from({ length: 16 }, (_, index) => event(String(index + 1))).reduce(
      updateTranscriptEvents,
      [],
    );

    expect(result).toHaveLength(15);
    expect(result.at(0)?.segmentId).toBe('2');
    expect(result.at(-1)?.segmentId).toBe('16');
  });

  it('selects only final system sentences for recap', () => {
    const segments: TranscriptEvent[] = [
      { ...event('system'), stream: 'system' },
      { ...event('mic'), stream: 'mic' },
      { ...event('partial', true), stream: 'system' },
    ];

    expect(selectRecentSystemSentences(segments)).toEqual(['Text system']);
  });
});
