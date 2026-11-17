import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import {
  formatRemaining,
  formatResetDate,
  planExpiryNotice,
  planName,
  usageFraction,
  usageLabel,
  USAGE_METRIC_ORDER,
  type UsageState,
} from '../lib/usage';

export interface UsageMeterProps {
  /** A usage metric id such as `translation_ms`; `*_ms` are milliseconds, the rest are counts. */
  metric: string;
  used: number;
  /** `null` = unlimited. */
  limit: number | null;
  state: UsageState;
  /** ISO time the allowance renews; shown as a date when given. */
  resetsAt?: string;
  className?: string;
}

const BAR: Record<UsageState, string> = {
  ok: 'bg-primary',
  low: 'bg-warning',
  exhausted: 'bg-destructive',
};
const TEXT: Record<UsageState, string> = {
  ok: 'text-muted-foreground',
  low: 'text-warning',
  exhausted: 'text-destructive',
};

/** One allowance as a labelled progress bar with what is left. Presentation only. */
export function UsageMeter({ metric, used, limit, state, resetsAt, className }: UsageMeterProps) {
  const label = usageLabel(metric);
  const remaining = formatRemaining(metric, used, limit);
  const percent = Math.round(usageFraction(used, limit) * 100);
  const reset = resetsAt ? formatResetDate(resetsAt) : '';

  return (
    <div data-state={state} className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn('shrink-0', TEXT[state])}>{remaining}</span>
      </div>
      {limit === null ? null : (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={remaining}
          className="bg-muted h-2 overflow-hidden rounded-full"
        >
          <div className={cn('h-full rounded-full', BAR[state])} style={{ width: `${percent}%` }} />
        </div>
      )}
      {reset && limit !== null && limit > 0 ? (
        <p className="text-muted-foreground text-xs">Làm mới ngày {reset}</p>
      ) : null}
    </div>
  );
}

export interface UsageSummaryProps {
  plan: string;
  /** When the paid plan ends (from `GET /v1/billing`); a reminder shows when it is within 3 days. */
  planExpiresAt?: string | null;
  /** The current time, for the reminder; tests pass a fixed one. */
  now?: Date;
  /** Next to the plan name, e.g. the "Nâng gói" button. The caller decides whether to offer it. */
  action?: ReactNode;
  /** One entry per metric id, as returned by `GET /v1/me/usage`. */
  usage: Record<string, Omit<UsageMeterProps, 'metric' | 'className'>>;
}

/** The plan name and one meter per allowance: the same block on web and desktop settings. */
export function UsageSummary({ plan, planExpiresAt, now, action, usage }: UsageSummaryProps) {
  const notice = planExpiryNotice(plan, planExpiresAt, now ?? new Date());
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          Gói hiện tại: <strong>{planName(plan)}</strong>
        </p>
        {action}
      </div>
      {notice ? (
        <p role="status" className="text-warning text-sm">
          {notice}
        </p>
      ) : null}
      {USAGE_METRIC_ORDER.map((metric) => {
        const item = usage[metric];
        return item ? <UsageMeter key={metric} metric={metric} {...item} /> : null;
      })}
    </>
  );
}
