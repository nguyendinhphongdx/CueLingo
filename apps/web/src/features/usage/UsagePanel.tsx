'use client';

import { USAGE_METRICS, type UsageResponse } from '@cuelingo/shared';
import { Section } from '@cuelingo/ui/components/section';
import { UsageMeter } from '@cuelingo/ui/components/usage-meter';
import { planName } from '@cuelingo/ui/lib/usage';
import { useUsage } from './use-usage';

interface UsagePanelViewProps {
  usage?: UsageResponse;
  loading: boolean;
  error: string | null;
}

/** Pure presentation of the plan and its allowances: no data fetching, easy to test. */
export function UsagePanelView({ usage, loading, error }: UsagePanelViewProps) {
  return (
    <Section
      title="Gói và lượng dùng"
      description="Hạn mức giờ dịch, nhận dạng đám mây và debrief được tính lại mỗi tháng (giờ Việt Nam)."
    >
      <div className="bg-card max-w-3xl space-y-4 rounded-xl border p-4 sm:p-5">
        {loading ? <p className="text-muted-foreground text-sm">Đang tải lượng dùng…</p> : null}
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        {usage ? (
          <>
            <p className="text-sm">
              Gói hiện tại: <strong>{planName(usage.plan)}</strong>
            </p>
            {USAGE_METRICS.map((metric) => (
              <UsageMeter key={metric} metric={metric} {...usage.usage[metric]} />
            ))}
          </>
        ) : null}
      </div>
    </Section>
  );
}

/** The plan name and one meter per allowance, on the settings page. */
export function UsagePanel() {
  const { usage, loading, error } = useUsage();
  return <UsagePanelView usage={usage} loading={loading} error={error} />;
}
