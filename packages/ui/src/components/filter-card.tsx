import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { NO_DATA_TEXT } from './stat-card';

export interface FilterCardProps {
  label: string;
  /** `null` means there is not enough data; a real 0 is shown as 0. */
  value: string | number | null;
  hint?: ReactNode;
  /** The filter this card stands for is on. Shown by colour and by `aria-pressed`. */
  selected: boolean;
  onSelect(): void;
  className?: string;
}

/** A stat card you can click to filter a list by it (the admin users page). A toggle button, not a link. */
export function FilterCard({ label, value, hint, selected, onSelect, className }: FilterCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'focus-visible:ring-ring flex w-full cursor-pointer flex-col items-start gap-1 rounded-lg border p-4 text-left shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none md:p-5',
        selected
          ? 'border-primary bg-secondary text-secondary-foreground'
          : 'bg-card text-card-foreground hover:bg-accent',
        className,
      )}
    >
      <span className="text-body-sm font-medium">{label}</span>
      {value === null ? (
        <span className="text-body-sm font-medium">{NO_DATA_TEXT}</span>
      ) : (
        <span className="text-title tabular-nums">{value}</span>
      )}
      {hint ? <span className="text-caption">{hint}</span> : null}
    </button>
  );
}
