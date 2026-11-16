import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BarChartCard, LineChartCard } from './chart-card';

const data = [
  { date: '2026-11-01', amount: 100, other: 1 },
  { date: '2026-11-02', amount: 0, other: 2 },
];

describe('chart cards', () => {
  it.each([
    ['LineChartCard', LineChartCard],
    ['BarChartCard', BarChartCard],
  ])('%s carries all its data in a table that only screen readers see', (_name, Chart) => {
    const html = renderToStaticMarkup(
      <Chart
        title="Doanh thu theo ngày"
        data={data}
        xKey="date"
        series={[
          { key: 'amount', label: 'Doanh thu' },
          { key: 'other', label: 'Khác' },
        ]}
        formatX={(d) => d.slice(5)}
        formatValue={(n) => `${n}đ`}
      />,
    );
    expect(html).toContain('<table class="sr-only">');
    expect(html).toContain('<caption>Doanh thu theo ngày</caption>');
    expect(html).toContain('<th scope="row">11-01</th>');
    expect(html).toContain('<td>100đ</td>');
    expect(html).toContain('<td>0đ</td>');
    expect(html).toContain('>Khác</th>');
    expect(html).toContain('aria-hidden="true"');
  });
});
