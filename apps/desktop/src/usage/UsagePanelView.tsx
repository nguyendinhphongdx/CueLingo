import type { UsageResponse } from '@cuelingo/shared';
import { Section } from '@cuelingo/ui/components/section';
import { UsageSummary } from '@cuelingo/ui/components/usage-meter';

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
      description="Giờ dịch, nhận dạng đám mây và debrief được tính lại mỗi tháng (giờ Việt Nam)."
    >
      <div className="bg-card space-y-4 rounded-xl border p-4">
        {loading ? <p className="text-muted-foreground text-sm">Đang tải lượng dùng…</p> : null}
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        {usage ? <UsageSummary plan={usage.plan} usage={usage.usage} /> : null}
      </div>
    </Section>
  );
}
