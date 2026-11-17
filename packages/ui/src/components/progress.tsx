import { cn } from '../lib/utils';

export interface ProgressProps {
  /** 0 to 1; values outside are clamped. */
  value: number;
  /** What is progressing, for screen readers ("Tải mô hình tiếng Anh"). */
  label: string;
  /** What a reader hears instead of the bare percentage ("Đang tải 42%"). */
  valueText?: string;
  className?: string;
}

/** A thin determinate bar. Presentation only; the caller says what the number means. */
export function Progress({ value, label, valueText, className }: ProgressProps) {
  const percent = Math.round(Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={valueText ?? `${percent}%`}
      className={cn('bg-muted h-2 overflow-hidden rounded-full', className)}
    >
      <div className="bg-primary h-full rounded-full" style={{ width: `${percent}%` }} />
    </div>
  );
}
