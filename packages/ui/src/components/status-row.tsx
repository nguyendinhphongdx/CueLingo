import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Badge } from './badge';

export type Status = 'ok' | 'warn' | 'error' | 'pending';

const LABEL: Record<Status, string> = {
  ok: 'Sẵn sàng',
  warn: 'Cần chú ý',
  error: 'Chưa dùng được',
  pending: 'Đang kiểm tra',
};
const VARIANT = {
  ok: 'success',
  warn: 'warning',
  error: 'destructive',
  pending: 'outline',
} as const;

export interface StatusRowProps {
  status: Status;
  title: string;
  detail?: string;
  /** The fix for this row, e.g. a Button; shown only when it is not ok. */
  action?: ReactNode;
  className?: string;
}

/** One readiness item (microphone, system audio, model) with its state and its own fix. */
export function StatusRow({ status, title, detail, action, className }: StatusRowProps) {
  return (
    <div data-status={status} className={cn('flex items-center gap-3 py-3', className)}>
      <div className="min-w-0 grow">
        <p className="text-sm font-medium">{title}</p>
        {detail ? <p className="text-muted-foreground text-sm">{detail}</p> : null}
      </div>
      <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>
      {status === 'ok' ? null : action}
    </div>
  );
}
