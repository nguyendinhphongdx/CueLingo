import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TranscriptEvent } from '../lib/native';
import { CaptionOverlay } from './CaptionOverlay';

const segment: TranscriptEvent = {
  segmentId: 'real-1',
  text: 'Original sentence',
  translation: 'Câu dịch',
  partial: false,
};

describe('CaptionOverlay', () => {
  it('shows three sample lines including one partial before the first transcript', () => {
    const markup = renderToStaticMarkup(
      <CaptionOverlay listen={false} segments={[]} receivedTranscript={false} />,
    );

    expect(markup.match(/data-slot="caption-line"/g)).toHaveLength(3);
    expect(markup.match(/data-partial="true"/g)).toHaveLength(1);
  });

  it('shows only translation at level 1', () => {
    const markup = renderToStaticMarkup(
      <CaptionOverlay listen={false} level={1} segments={[segment]} receivedTranscript />,
    );

    expect(markup).toContain('Câu dịch');
    expect(markup).not.toContain('Original sentence');
  });

  it('shows original and translation at levels 3 and 4', () => {
    for (const level of [3, 4]) {
      const markup = renderToStaticMarkup(
        <CaptionOverlay listen={false} level={level} segments={[segment]} receivedTranscript />,
      );
      expect(markup).toContain('Original sentence');
      expect(markup).toContain('Câu dịch');
    }
  });

  it('keeps an empty frame at level 0', () => {
    const markup = renderToStaticMarkup(
      <CaptionOverlay listen={false} level={0} segments={[segment]} receivedTranscript />,
    );

    expect(markup).toContain('aria-label="Caption trực tiếp"');
    expect(markup).not.toContain('data-slot="caption-line"');
  });
});
