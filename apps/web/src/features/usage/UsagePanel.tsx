'use client';

import { type UsageResponse } from '@cuelingo/shared';
import { Section } from '@cuelingo/ui/components/section';
import { UsageSummary } from '@cuelingo/ui/components/usage-meter';
import type { ReactNode } from 'react';
import { UpgradeLink, useBillingOverview } from '../billing';
import { useUsage } from './use-usage';

interface UsagePanelViewProps {
  usage?: UsageResponse;
  loading: boolean;
  error: string | null;
  /** When the paid plan ends; a reminder shows within 3 days of it. */
  planExpiresAt?: string | null;
  /** The "Nâng gói" button; absent when payments are off. */
  action?: ReactNode;
}

/** Pure presentation of the plan and its allowances: no data fetching, easy to test. */
export function UsagePanelView({
  usage,
  loading,
  error,
  planExpiresAt,
  action,
}: UsagePanelViewProps) {
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
          <UsageSummary
            plan={usage.plan}
            planExpiresAt={planExpiresAt}
            action={action}
            usage={usage.usage}
          />
        ) : null}
      </div>
    </Section>
  );
}

/** The plan name and one meter per allowance, on the settings page. */
export function UsagePanel() {
  const { usage, loading, error } = useUsage();
  const { overview } = useBillingOverview();
  return (
    <UsagePanelView
      usage={usage}
      loading={loading}
      error={error}
      planExpiresAt={overview?.current.expiresAt}
      action={<UpgradeLink />}
    />
  );
}
