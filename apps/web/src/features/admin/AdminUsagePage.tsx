'use client';

import type { AdminUsage } from '@cuelingo/shared';
import { Card, CardContent } from '@cuelingo/ui/components/card';
import { Section } from '@cuelingo/ui/components/section';
import { StatCard, StatGrid } from '@cuelingo/ui/components/stat-card';
import { usageLabel } from '@cuelingo/ui/lib/usage';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AnalyticsFrame } from './AnalyticsFrame';
import { number, usageAmount } from './analytics-format';
import { useAdminUsage } from './use-admin-analytics';

const usd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

/** A count of people over a share of the limit, linking to the user list filtered the same way. */
function Reach({
  metric,
  atLeast,
  value,
}: {
  metric: string;
  atLeast: '80' | '100';
  value: number | null;
}) {
  if (value === null) return <span className="text-muted-foreground">Không áp dụng</span>;
  return (
    <Link
      href={`/admin/users?metric=${metric}&atLeast=${atLeast}`}
      className="font-medium tabular-nums underline underline-offset-2"
    >
      {number.format(value)}
    </Link>
  );
}

export function AdminUsageView({ usage }: { usage: AdminUsage }) {
  const head = 'text-muted-foreground px-4 py-3 text-left font-medium';
  const mean = (metric: string, value: number | null) =>
    value === null ? '—' : usageAmount(metric, value);
  return (
    <>
      <StatGrid>
        <StatCard
          label="Chi phí AI ước tính tháng này"
          value={usage.aiCostUsdThisMonth === null ? null : usd.format(usage.aiCostUsdThisMonth)}
          hint="Tổng chi phí các lời gọi AI đã ghi"
        />
      </StatGrid>
      <Section title="Hạn mức tháng này">
        <Card>
          <CardContent className="overflow-x-auto px-0 py-0">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <caption className="sr-only">Lượng dùng tháng này theo hạn mức</caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className={head}>
                    Hạn mức
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    Tổng
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    Trung bình · Free
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    Pro
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    Ultra
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    Người ≥ 80%
                  </th>
                  <th scope="col" className={`${head} text-right`}>
                    Người = 100%
                  </th>
                </tr>
              </thead>
              <tbody>
                {usage.metrics.map((m) => (
                  <tr key={m.metric} className="border-b last:border-0">
                    <th scope="row" className="px-4 py-3 text-left font-medium">
                      {usageLabel(m.metric)}
                    </th>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {usageAmount(m.metric, m.total)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {mean(m.metric, m.averageByPlan.free)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {mean(m.metric, m.averageByPlan.pro)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {mean(m.metric, m.averageByPlan.ultra)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Reach metric={m.metric} atLeast="80" value={m.atLeast80} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Reach metric={m.metric} atLeast="100" value={m.atLeast100} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <p className="text-muted-foreground text-xs">
          Trung bình tính trên mọi người đang ở gói đó, kể cả người chưa dùng. Cột ≥ 80% gồm cả
          người đã hết hạn mức. "Không áp dụng": gói đó không giới hạn hoặc hạn mức bằng 0.
        </p>
      </Section>
    </>
  );
}

export function AdminUsagePage() {
  const { data, loading, hidden, error, reload, reloading } = useAdminUsage();
  if (hidden) notFound();
  return (
    <AnalyticsFrame
      title="Lượng dùng"
      description="Ai sắp chạm hạn mức và dùng bao nhiêu theo gói, tính từ đầu tháng (giờ Việt Nam)."
      generatedAt={data?.generatedAt}
      loading={loading}
      error={error}
      onReload={reload}
      reloading={reloading}
    >
      {data ? <AdminUsageView usage={data} /> : null}
    </AnalyticsFrame>
  );
}
