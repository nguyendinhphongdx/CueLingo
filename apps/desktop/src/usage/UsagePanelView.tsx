import type { UsageResponse } from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Section } from '@cuelingo/ui/components/section';
import { UsageSummary } from '@cuelingo/ui/components/usage-meter';

interface UsagePanelViewProps {
  usage?: UsageResponse;
  loading: boolean;
  error: string | null;
  /** When the paid plan ends; a reminder shows within 3 days of it. */
  planExpiresAt?: string | null;
  /** Given only when payments are on: shows the "Nâng gói" button. */
  onUpgrade?: () => void;
}

/** Pure presentation of the plan and its allowances: no data fetching, easy to test. */
export function UsagePanelView({
  usage,
  loading,
  error,
  planExpiresAt,
  onUpgrade,
}: UsagePanelViewProps) {
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
        {usage ? (
          <UsageSummary
            plan={usage.plan}
            planExpiresAt={planExpiresAt}
            action={
              onUpgrade ? (
                <Button size="sm" variant="outline" onClick={onUpgrade}>
                  Nâng gói
                </Button>
              ) : undefined
            }
            usage={usage.usage}
          />
        ) : null}
      </div>
    </Section>
  );
}
