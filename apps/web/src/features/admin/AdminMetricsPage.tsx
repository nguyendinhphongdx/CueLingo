'use client';

import type { AdminActivity, AdminMetrics } from '@cuelingo/shared';
import { BarChartCard, LineChartCard } from '@cuelingo/ui/components/chart-card';
import { StatCard, StatGrid } from '@cuelingo/ui/components/stat-card';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { Section } from '@cuelingo/ui/components/section';
import { notFound } from 'next/navigation';
import { AnalyticsFrame } from './AnalyticsFrame';
import { dayLabel } from './analytics-format';
import { useAdminActivity } from './use-admin-analytics';

const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const usd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 4,
});

const valueOrDash = (value: number | null, format = number) =>
  value === null ? '—' : format.format(value);

const percent = (value: number | null) =>
  value === null ? null : `${number.format(value * 100)}%`;

/** The beta gate numbers. A figure with no data yet says so instead of showing a misleading 0. */
export function betaStats(beta: AdminMetrics['beta']): Array<[string, string | null]> {
  return [
    [
      'Từ cài tới caption đầu · trung vị',
      beta.medianMinutesToFirstCaption === null
        ? null
        : `${number.format(beta.medianMinutesToFirstCaption)} phút`,
    ],
    [
      'Họp / tuần / người',
      beta.meetingsPerUserWeek === null ? null : number.format(beta.meetingsPerUserWeek),
    ],
    ['D1', percent(beta.d1)],
    ['D7', percent(beta.d7)],
    ['Phản hồi · 30 ngày', number.format(beta.feedback30d)],
  ];
}

export function AdminMetricsView({ metrics }: { metrics: AdminMetrics }) {
  const stats = [
    ['Người dùng hoạt động · 7 ngày', number.format(metrics.activeUsers7d)],
    ['Cuộc họp · 7 ngày', number.format(metrics.meetings.last7Days.count)],
    ['Giờ họp · 7 ngày', number.format(metrics.meetings.last7Days.totalHours)],
    ['Cuộc họp · 30 ngày', number.format(metrics.meetings.last30Days.count)],
    ['Giờ họp · 30 ngày', number.format(metrics.meetings.last30Days.totalHours)],
    ['Chi phí AI / giờ họp', valueOrDash(metrics.aiCostPerMeetingHourUsd, usd)],
    [
      'Debrief trung vị',
      metrics.debriefLatencyMinutes.median === null
        ? '—'
        : `${number.format(metrics.debriefLatencyMinutes.median)} phút`,
    ],
    [
      'Debrief p95',
      metrics.debriefLatencyMinutes.p95 === null
        ? '—'
        : `${number.format(metrics.debriefLatencyMinutes.p95)} phút`,
    ],
    [
      'Debrief thành công · 30 ngày',
      metrics.debriefSuccessRate === null
        ? '—'
        : `${number.format(metrics.debriefSuccessRate * 100)}%`,
    ],
  ] as const;

  return (
    <>
      <Section title="Tổng quan">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map(([label, value]) => (
            <Card key={label}>
              <CardContent className="pt-5">
                <dt className="text-muted-foreground text-sm leading-5">{label}</dt>
                <dd className="mt-2 text-3xl leading-none font-semibold tracking-tight tabular-nums">
                  {value}
                </dd>
              </CardContent>
            </Card>
          ))}
        </dl>
      </Section>
      <Section title="Beta">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {betaStats(metrics.beta).map(([label, value]) => (
            <Card key={label}>
              <CardContent className="pt-5">
                <dt className="text-muted-foreground text-sm leading-5">{label}</dt>
                <dd className="mt-2 text-3xl leading-none font-semibold tracking-tight tabular-nums">
                  {value ?? (
                    <span className="text-muted-foreground text-base">Chưa đủ dữ liệu</span>
                  )}
                </dd>
              </CardContent>
            </Card>
          ))}
        </dl>
      </Section>
      <Section title="Phiên ôn trong 14 ngày">
        <Card>
          <CardContent className="overflow-x-auto px-0 py-0">
            <table className="w-full min-w-96 border-collapse text-sm">
              <caption className="sr-only">Số phiên ôn theo ngày trong 14 ngày gần nhất</caption>
              <thead>
                <tr className="border-b text-left">
                  <th scope="col" className="text-muted-foreground px-5 py-3 font-medium">
                    Ngày
                  </th>
                  <th
                    scope="col"
                    className="text-muted-foreground px-5 py-3 text-right font-medium"
                  >
                    Số phiên
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.reviewSessions14d.map((day) => (
                  <tr key={day.date} className="border-b last:border-0">
                    <th scope="row" className="px-5 py-3 text-left font-normal">
                      {new Intl.DateTimeFormat('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        timeZone: 'UTC',
                      }).format(new Date(`${day.date}T00:00:00Z`))}
                    </th>
                    <td className="px-5 py-3 text-right font-medium tabular-nums">
                      {number.format(day.count)}
                    </td>
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

/** The page "Hoạt động app": the beta numbers of `/v1/admin/metrics` plus meetings per day and who met. */
export function AdminActivityView({ activity }: { activity: AdminActivity }) {
  return (
    <>
      <Section title="Người dùng họp">
        <StatGrid>
          <StatCard
            label="DAU · 1 ngày"
            value={number.format(activity.meetingUsers.dau)}
            hint="Người có phiên họp"
          />
          <StatCard label="WAU · 7 ngày" value={number.format(activity.meetingUsers.wau)} />
          <StatCard label="MAU · 30 ngày" value={number.format(activity.meetingUsers.mau)} />
        </StatGrid>
      </Section>
      <BarChartCard
        title="Cuộc họp theo ngày"
        description="30 ngày gần nhất, giờ Việt Nam"
        data={activity.daily}
        xKey="date"
        formatX={dayLabel}
        series={[{ key: 'meetings', label: 'Cuộc họp' }]}
      />
      <LineChartCard
        title="Giờ họp theo ngày"
        description="Chỉ tính cuộc họp đã kết thúc"
        data={activity.daily}
        xKey="date"
        formatX={dayLabel}
        formatValue={(value) => number.format(value)}
        series={[{ key: 'hours', label: 'Giờ họp' }]}
      />
      <AdminMetricsView metrics={activity.metrics} />
    </>
  );
}

export function AdminMetricsPage() {
  const { data, loading, hidden, error, reload, reloading } = useAdminActivity();
  if (hidden) notFound();
  return (
    <AnalyticsFrame
      title="Hoạt động app"
      description="Tín hiệu vận hành tổng hợp, không chứa nội dung hoặc thông tin định danh."
      generatedAt={data?.generatedAt}
      loading={loading}
      error={error}
      onReload={reload}
      reloading={reloading}
    >
      {data ? <AdminActivityView activity={data} /> : null}
    </AnalyticsFrame>
  );
}
