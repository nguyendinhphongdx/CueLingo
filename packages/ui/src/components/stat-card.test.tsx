import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NO_DATA_TEXT, StatCard } from './stat-card';

describe('StatCard', () => {
  it('shows "Chưa đủ dữ liệu" for null, never 0', () => {
    const html = renderToStaticMarkup(<StatCard label="Tỉ lệ đơn được trả" value={null} />);
    expect(html).toContain(NO_DATA_TEXT);
    expect(html).not.toContain('>0<');
  });

  it('shows a real zero as 0, with its hint', () => {
    const html = renderToStaticMarkup(<StatCard label="Đơn" value={0} hint="30 ngày qua" />);
    expect(html).toContain('>0<');
    expect(html).not.toContain(NO_DATA_TEXT);
    expect(html).toContain('30 ngày qua');
  });
});
