import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HighlightedText } from './highlighted-text';

describe('HighlightedText', () => {
  it('marks each match with a token-coloured mark and leaves the rest', () => {
    const markup = renderToStaticMarkup(
      <HighlightedText text="Budget and budget" query="BUDGET" />,
    );
    expect(markup.match(/<mark/g)).toHaveLength(2);
    expect(markup).toContain('bg-warning/20');
    expect(markup).toContain('> and </span>');
  });

  it('marks nothing without a query', () => {
    expect(renderToStaticMarkup(<HighlightedText text="same" query="" />)).not.toContain('<mark');
  });
});
