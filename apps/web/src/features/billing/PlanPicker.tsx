import type {
  BillingOffer,
  BillingOverviewResponse,
  BillingPeriod,
  PaidPlan,
} from '@cuelingo/shared';
import { Button } from '@cuelingo/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@cuelingo/ui/components/card';
import {
  formatUsageAmount,
  formatVnd,
  planName,
  usageLabel,
  USAGE_METRIC_ORDER,
} from '@cuelingo/ui/lib/usage';

const PLANS: readonly PaidPlan[] = ['pro', 'ultra'];
const PERIOD_LABEL: Record<BillingPeriod, string> = { month: 'Theo tháng', year: 'Theo năm' };
const PERIOD_UNIT: Record<BillingPeriod, string> = { month: '/tháng', year: '/năm' };

export interface PlanPickerProps {
  overview: BillingOverviewResponse;
  /** `plan:period` of the order being created, to disable its button. */
  busy?: string | null;
  onSelect: (plan: PaidPlan, period: BillingPeriod) => void;
}

function limitText(metric: string, limit: number | null): string {
  if (limit === null) return 'Không giới hạn';
  if (limit === 0) return 'Không có';
  return formatUsageAmount(metric, limit);
}

/** A year is shown as "10 tháng" only when the server's prices really are 10x the month. */
function yearIsTenMonths(month?: BillingOffer, year?: BillingOffer): boolean {
  return Boolean(month && year && year.amount === month.amount * 10);
}

/** Pro/Ultra × month/year with the price and allowances the server sent (AC1). Presentation only. */
export function PlanPicker({ overview, busy = null, onSelect }: PlanPickerProps) {
  const { current, offers } = overview;
  const shown = PLANS.filter((plan) => offers.some((offer) => offer.plan === plan));
  if (shown.length === 0) {
    return <p className="text-muted-foreground text-sm">Hiện chưa có gói nào để nâng.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        {shown.map((plan) => {
          const month = offers.find((o) => o.plan === plan && o.period === 'month');
          const year = offers.find((o) => o.plan === plan && o.period === 'year');
          const limits = (month ?? year)!.limits;
          return (
            <Card key={plan} data-plan={plan}>
              <CardHeader>
                <CardTitle>{planName(plan)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-1 text-sm">
                  {USAGE_METRIC_ORDER.map((metric) => (
                    <li key={metric} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{usageLabel(metric)}</span>
                      <span className="shrink-0 font-medium">
                        {limitText(metric, limits[metric])}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  {[month, year].map((offer) =>
                    offer ? (
                      <Button
                        key={offer.period}
                        variant={offer.period === 'year' ? 'default' : 'outline'}
                        className="min-h-11 w-full justify-between"
                        disabled={busy !== null}
                        onClick={() => onSelect(offer.plan, offer.period)}
                      >
                        <span>{PERIOD_LABEL[offer.period]}</span>
                        <span>
                          {formatVnd(offer.amount)}
                          {PERIOD_UNIT[offer.period]}
                        </span>
                      </Button>
                    ) : null,
                  )}
                </div>
                {yearIsTenMonths(month, year) ? (
                  <p className="text-muted-foreground text-xs">
                    Trả theo năm chỉ tính 10 tháng, tiết kiệm 2 tháng.
                  </p>
                ) : null}
                {plan === 'ultra' && current.plan === 'pro' && current.expiresAt ? (
                  <p className="text-muted-foreground text-xs">
                    Phần Pro còn lại của bạn được quy đổi thành ngày Ultra.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-muted-foreground text-xs">
        Thanh toán trước bằng chuyển khoản QR, không tự gia hạn. Hết hạn thì về gói Free, dữ liệu
        của bạn vẫn giữ nguyên.
      </p>
    </div>
  );
}
