import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TranscriptEvent } from '../lib/native';
import { CaptionOverlay, clampFontSize } from './CaptionOverlay';
import { listenForOverlaySettings } from './use-overlay-settings';

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

  it('makes the translation prominent at level 3', () => {
    const markup = renderToStaticMarkup(
      <CaptionOverlay listen={false} level={3} segments={[segment]} receivedTranscript />,
    );

    expect(markup).toContain('[&amp;&gt;p+p]:font-bold');
  });

  it('keeps an empty frame at level 0', () => {
    const markup = renderToStaticMarkup(
      <CaptionOverlay listen={false} level={0} segments={[segment]} receivedTranscript />,
    );

    expect(markup).toContain('aria-label="Caption trực tiếp"');
    expect(markup).not.toContain('data-slot="caption-line"');
  });

  it('renders font and theme controls and clamps font size to 14–24 px', () => {
    const markup = renderToStaticMarkup(
      <CaptionOverlay listen={false} initialFontSize={20} initialTheme="light" />,
    );

    expect(markup).toContain('aria-label="Giảm cỡ chữ"');
    expect(markup).toContain('aria-label="Tăng cỡ chữ"');
    expect(markup).toContain('data-theme="light"');
    expect(markup).toContain('font-size:20px');
    expect(clampFontSize(10)).toBe(14);
    expect(clampFontSize(30)).toBe(24);
  });

  it('applies assist level updates received from the main window', async () => {
    let listener: ((event: { assistLevel: number }) => void) | undefined;
    const callback = vi.fn();
    const source = {
      onSettings: vi.fn(async (next: (event: { assistLevel: number }) => void) => {
        listener = next;
        return vi.fn();
      }),
    };

    await listenForOverlaySettings(callback, source);
    listener?.({ assistLevel: 1 });

    expect(callback).toHaveBeenCalledWith({ assistLevel: 1 });
  });
});
