import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export type NoticeTone = 'info' | 'warning' | 'error';

const TONE: Record<NoticeTone, string> = {
  info: 'border-primary/30 bg-primary/5',
  warning: 'border-warning/40 bg-warning/10',
  error: 'border-destructive/40 bg-destructive/10',
};

/** A banner for a limit, a missing permission or a failure, with the action that fixes it. */
export function NoticeStrip({
  tone = 'info',
  children,
  action,
  className,
}: {
  tone?: NoticeTone;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      data-tone={tone}
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm',
        TONE[tone],
        className,
      )}
    >
      <div className="min-w-0 grow">{children}</div>
      {action}
    </div>
  );
}
