import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CaptionLine } from './caption-line';

describe('CaptionLine', () => {
  it('renders text, translation, and case-insensitive hard words', () => {
    const markup = renderToStaticMarkup(
      <CaptionLine
        text="We should Push Back on that."
        translation="Chúng ta nên phản đối điều đó."
        hardWords={['push', 'push back']}
      />,
    );

    expect(markup).toContain('We should <u>Push Back</u> on that.');
    expect(markup).toContain('Chúng ta nên phản đối điều đó.');
    expect(markup).not.toContain('<u>Push</u> Back');
  });

  it('marks partial captions and applies a muted style', () => {
    const markup = renderToStaticMarkup(<CaptionLine text="Still speaking" partial />);

    expect(markup).toContain('data-partial="true"');
    expect(markup).toContain('opacity-60');
  });

  it('does not render a translation line when translation is absent', () => {
    const markup = renderToStaticMarkup(<CaptionLine text="Final caption" />);

    expect(markup.match(/<p/g)).toHaveLength(1);
    expect(markup).not.toContain('text-muted-foreground');
  });
});
