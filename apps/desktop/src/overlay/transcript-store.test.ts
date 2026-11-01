import { describe, expect, it } from 'vitest';
import type { TranscriptEvent } from '../lib/native';
import { updateTranscriptEvents } from './transcript-store';

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

  it('keeps only the six most recent segments', () => {
    const result = Array.from({ length: 7 }, (_, index) => event(String(index + 1))).reduce(
      updateTranscriptEvents,
      [],
    );

    expect(result).toHaveLength(6);
    expect(result.map(({ segmentId }) => segmentId)).toEqual(['2', '3', '4', '5', '6', '7']);
  });
});
