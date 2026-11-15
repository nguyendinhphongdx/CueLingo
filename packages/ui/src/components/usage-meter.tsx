import { cn } from '../lib/utils';
import {
  formatRemaining,
  formatResetDate,
  usageFraction,
  usageLabel,
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
  low: 'bg-amber-500 dark:bg-amber-400',
  exhausted: 'bg-destructive',
};
const TEXT: Record<UsageState, string> = {
  ok: 'text-muted-foreground',
  low: 'text-amber-700 dark:text-amber-400',
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
