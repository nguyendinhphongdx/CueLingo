import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export const NO_DATA_TEXT = 'Chưa đủ dữ liệu';

export interface StatCardProps {
  label: string;
  /** `null` means there is not enough data to compute it (a rate over zero orders); a real 0 is shown as 0. */
  value: string | number | null;
  /** One line under the value, such as how the number is worked out. */
  hint?: ReactNode;
  className?: string;
}

/** One number with its label. Presentation only; format the value before passing it. */
export function StatCard({ label, value, hint, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-card text-card-foreground flex flex-col gap-1 rounded-xl border p-4 shadow-sm',
        className,
      )}
    >
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      {value === null ? (
        <p className="text-muted-foreground text-sm font-medium">{NO_DATA_TEXT}</p>
      ) : (
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      )}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

/** A responsive grid of stat cards. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4', className)}>
      {children}
    </div>
  );
}
