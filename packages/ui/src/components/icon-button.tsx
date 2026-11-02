import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../lib/utils';

/**
 * A quiet icon-only button. The label is both the accessible name and the tooltip, so an icon never
 * ships without words behind it.
 */
export function IconButton({
  label,
  icon,
  active = false,
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'children' | 'aria-label'> & {
  label: string;
  icon: ReactNode;
  /** Shown pressed (a menu or drawer it controls is open). */
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'focus-visible:ring-ring text-muted-foreground hover:text-foreground hover:bg-foreground/10 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default disabled:opacity-50',
        active && 'bg-foreground/10 text-foreground',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
