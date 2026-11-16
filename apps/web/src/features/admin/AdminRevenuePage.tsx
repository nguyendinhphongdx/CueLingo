'use client';

import type { AdminRevenue } from '@cuelingo/shared';
import { BarChartCard } from '@cuelingo/ui/components/chart-card';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { Section } from '@cuelingo/ui/components/section';
import { StatCard, StatGrid } from '@cuelingo/ui/components/stat-card';
import { formatVnd, planName } from '@cuelingo/ui/lib/usage';
import { notFound } from 'next/navigation';
import { AnalyticsFrame } from './AnalyticsFrame';
import { dayLabel, monthLabel, number, ORDER_STATUS_LABEL, percent } from './analytics-format';
import { useAdminRevenue } from './use-admin-analytics';

const PERIOD = { month: 'Tháng', year: 'Năm' } as const;

export function AdminRevenueView({ revenue }: { revenue: AdminRevenue }) {
  const thisMonth = revenue.monthly.at(-1)?.amount ?? 0;
  const head = 'text-muted-foreground px-4 py-3 text-left font-medium';
  return (
    <>
      <StatGrid>
        <StatCard label="Doanh thu tháng này" value={formatVnd(thisMonth)} />
        <StatCard
          label="Tỉ lệ đơn được trả"
          value={percent(revenue.paidRate)}
          hint="Đơn đã trả / đơn đã tạo, 30 ngày"
        />
        <StatCard
          label="Lần admin tặng gói"
          value={number.format(revenue.adminGrants)}
          hint="30 ngày, không tính vào doanh thu"
        />
        {(Object.keys(ORDER_STATUS_LABEL) as Array<keyof typeof ORDER_STATUS_LABEL>).map((s) => (
          <StatCard
            key={s}
            label={`Đơn ${ORDER_STATUS_LABEL[s].toLowerCase()}`}
            value={number.format(revenue.ordersByStatus[s])}
            hint="30 ngày"
          />
        ))}
      </StatGrid>
      <BarChartCard
        title="Doanh thu theo ngày"
        description="30 ngày gần nhất, giờ Việt Nam"
        data={revenue.daily}
        xKey="date"
        formatX={dayLabel}
        formatValue={formatVnd}
        series={[{ key: 'amount', label: 'Doanh thu' }]}
      />
      <BarChartCard
        title="Doanh thu theo tháng"
        description="12 tháng gần nhất"
        data={revenue.monthly}
        xKey="month"
        xLabel="Tháng"
        formatX={monthLabel}
        formatValue={formatVnd}
        series={[{ key: 'amount', label: 'Doanh thu' }]}
      />
      <Section title="Theo gói và kỳ · 30 ngày">
        <Card>
          <CardContent className="overflow-x-auto px-0 py-0">
            <table className="w-full min-w-96 border-collapse text-sm">
              <caption className="sr-only">Doanh thu theo gói và kỳ trong 30 ngày</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className={head}>
                    Gói
                  </th>
                  <th scope="col" className={head}>
                    Kỳ
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    Đơn
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    Doanh thu
                  </th>
                </tr>
              </thead>
              <tbody>
                {revenue.byPlanPeriod.map((row) => (
                  <tr key={`${row.plan}-${row.period}`} className="border-b last:border-0">
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      {planName(row.plan)}
                    </th>
                    <td className="px-4 py-3">{PERIOD[row.period]}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {number.format(row.orders)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatVnd(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </Section>
    </>
  );
}

export function AdminRevenuePage() {
  const { data, loading, hidden, error, reload, reloading } = useAdminRevenue();
  if (hidden) notFound();
  return (
    <AnalyticsFrame
      title="Doanh thu"
      description="Chỉ tính đơn đã trả qua chuyển khoản. Gói admin tặng (đơn 0đ) được đếm riêng."
      generatedAt={data?.generatedAt}
      loading={loading}
      error={error}
      onReload={reload}
      reloading={reloading}
    >
      {data ? <AdminRevenueView revenue={data} /> : null}
    </AnalyticsFrame>
  );
}
