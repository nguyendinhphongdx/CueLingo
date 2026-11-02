'use client';

import type { AdminMetrics } from '@cuelingo/shared';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { Section } from '@cuelingo/ui/components/section';
import { notFound } from 'next/navigation';
import { useAdminMetrics } from './use-admin-metrics';

const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
const usd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 4,
});

const valueOrDash = (value: number | null, format = number) =>
  value === null ? '—' : format.format(value);

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
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Số liệu nội bộ"
        description="Tín hiệu vận hành tổng hợp, không chứa nội dung hoặc thông tin định danh."
      />
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
      <p className="text-muted-foreground mt-6 text-xs">
        Cập nhật lúc{' '}
        {new Intl.DateTimeFormat('vi-VN', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(metrics.generatedAt))}
      </p>
    </main>
  );
}

export function AdminMetricsPage() {
  const { metrics, loading, hidden, error } = useAdminMetrics();
  if (hidden) notFound();
  if (loading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="Số liệu nội bộ" />
        <p className="text-muted-foreground text-sm" aria-live="polite">
          Đang tải số liệu…
        </p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="Số liệu nội bộ" />
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      </main>
    );
  }
  if (!metrics) notFound();
  return <AdminMetricsView metrics={metrics} />;
}
