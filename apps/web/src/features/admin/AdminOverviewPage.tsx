'use client';

import type { AdminOverview } from '@cuelingo/shared';
import { LineChartCard } from '@cuelingo/ui/components/chart-card';
import { Section } from '@cuelingo/ui/components/section';
import { StatCard, StatGrid } from '@cuelingo/ui/components/stat-card';
import { formatVnd } from '@cuelingo/ui/lib/usage';
import { notFound } from 'next/navigation';
import { AnalyticsFrame } from './AnalyticsFrame';
import { dayLabel, number } from './analytics-format';
import { useAdminOverview } from './use-admin-analytics';

export function AdminOverviewView({ overview }: { overview: AdminOverview }) {
  const n = (value: number) => number.format(value);
  return (
    <>
      <Section title="Người dùng">
        <StatGrid>
          <StatCard label="Tổng người dùng" value={n(overview.totalUsers)} />
          <StatCard label="Người mới · 7 ngày" value={n(overview.newUsers.d7)} />
          <StatCard label="Người mới · 30 ngày" value={n(overview.newUsers.d30)} />
          <StatCard label="Gói trả phí hết hạn · 7 ngày tới" value={n(overview.expiringIn7d)} />
          <StatCard
            label="Hoạt động · 1 ngày"
            value={n(overview.activeUsers.d1)}
            hint="Có họp hoặc phiên ôn"
          />
          <StatCard label="Hoạt động · 7 ngày" value={n(overview.activeUsers.d7)} />
          <StatCard label="Hoạt động · 30 ngày" value={n(overview.activeUsers.d30)} />
        </StatGrid>
      </Section>
      <Section title="Gói và doanh thu">
        <StatGrid>
          <StatCard label="Free" value={n(overview.byPlan.free)} hint="Gói còn hạn" />
          <StatCard label="Pro" value={n(overview.byPlan.pro)} />
          <StatCard label="Ultra" value={n(overview.byPlan.ultra)} />
          <StatCard label="Doanh thu tháng này" value={formatVnd(overview.revenueThisMonth)} />
        </StatGrid>
      </Section>
      <LineChartCard
        title="Người mới và người hoạt động theo ngày"
        description="30 ngày gần nhất, giờ Việt Nam"
        data={overview.daily}
        xKey="date"
        formatX={dayLabel}
        series={[
          { key: 'newUsers', label: 'Người mới' },
          { key: 'activeUsers', label: 'Người hoạt động' },
        ]}
      />
    </>
  );
}

export function AdminOverviewPage() {
  const { data, loading, hidden, error, reload, reloading } = useAdminOverview();
  if (hidden) notFound();
  return (
    <AnalyticsFrame
      title="Tổng quan"
      description="Người dùng, gói và doanh thu trong một trang. Chỉ số tổng hợp, không có thông tin định danh."
      generatedAt={data?.generatedAt}
      loading={loading}
      error={error}
      onReload={reload}
      reloading={reloading}
    >
      {data ? <AdminOverviewView overview={data} /> : null}
    </AnalyticsFrame>
  );
}
