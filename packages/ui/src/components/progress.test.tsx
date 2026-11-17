import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Progress } from './progress';

describe('Progress', () => {
  it('is a labelled progressbar with the percentage', () => {
    const html = renderToStaticMarkup(<Progress value={0.426} label="Tải mô hình" />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Tải mô hình"');
    expect(html).toContain('aria-valuenow="43"');
    expect(html).toContain('width:43%');
  });

  it('clamps out-of-range and non-numeric values', () => {
    expect(renderToStaticMarkup(<Progress value={2} label="x" />)).toContain('aria-valuenow="100"');
    expect(renderToStaticMarkup(<Progress value={-1} label="x" />)).toContain('aria-valuenow="0"');
    expect(renderToStaticMarkup(<Progress value={Number.NaN} label="x" />)).toContain(
      'aria-valuenow="0"',
    );
  });

  it('reads the given text instead of the bare number', () => {
    const html = renderToStaticMarkup(<Progress value={0.5} label="x" valueText="Đang tải 50%" />);
    expect(html).toContain('aria-valuetext="Đang tải 50%"');
  });
});
