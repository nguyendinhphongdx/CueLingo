import { CheckCircle2, CircleDashed, Cloud, Loader2, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Button } from './button';

/** Where a speech-recognition model stands on this device. `cloud` = no model is needed for this language. */
export type ModelStatusState =
  'unknown' | 'missing' | 'cached' | 'downloading' | 'compiling' | 'ready' | 'error' | 'cloud';

export interface ModelStatusRowProps {
  /** What the model is for, for example "Nhận dạng tiếng Anh". */
  title: string;
  state: ModelStatusState;
  /** 0..1 while `downloading`. */
  progress?: number;
  /** Download size to tell the person before it starts, for example "khoảng 600 MB". */
  sizeLabel?: string;
  /** Why it failed, shown under the title when `state` is `error`. */
  errorText?: string;
  /** The one action that fits the state (download, retry, prepare). Hidden while busy and when `ready`. */
  actionLabel?: string;
  onAction?: () => void;
  /** An optional second action, for example "Bỏ qua" in onboarding. */
  secondary?: ReactNode;
  className?: string;
}

/** The sentence under the title. Presentation only: the same wording in onboarding and in settings. */
export function modelStatusText(state: ModelStatusState, progress = 0, sizeLabel?: string): string {
  switch (state) {
    case 'unknown':
      return 'Đang kiểm tra mô hình…';
    case 'missing':
      return sizeLabel ? `Chưa tải về máy. Dung lượng ${sizeLabel}.` : 'Chưa tải về máy.';
    case 'cached':
      return 'Đã tải về, cần chuẩn bị cho bản CueLingo này (vài chục giây).';
    case 'downloading':
      return `Đang tải mô hình… ${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
    case 'compiling':
      return 'Đang chuẩn bị mô hình cho máy này… (vài chục giây)';
    case 'ready':
      return 'Mô hình đã sẵn sàng.';
    case 'error':
      return 'Không tải được mô hình.';
    case 'cloud':
      return 'Ngôn ngữ này nhận dạng trên đám mây, không cần tải gì.';
  }
}

function StateIcon({ state }: { state: ModelStatusState }) {
  if (state === 'downloading' || state === 'compiling' || state === 'unknown') {
    return <Loader2 aria-hidden="true" className="text-muted-foreground size-5 animate-spin" />;
  }
  if (state === 'ready') {
    return <CheckCircle2 aria-hidden="true" className="size-5 text-success" />;
  }
  if (state === 'error') {
    return <XCircle aria-hidden="true" className="size-5 text-destructive" />;
  }
  if (state === 'cloud')
    return <Cloud aria-hidden="true" className="text-muted-foreground size-5" />;
  return <CircleDashed aria-hidden="true" className="text-muted-foreground size-5" />;
}

/** A labelled status line for an on-device model with a progress bar and its action. Presentation only. */
export function ModelStatusRow({
  title,
  state,
  progress = 0,
  sizeLabel,
  errorText,
  actionLabel,
  onAction,
  secondary,
  className,
}: ModelStatusRowProps) {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const busy = state === 'downloading' || state === 'compiling' || state === 'unknown';
  const showAction =
    Boolean(actionLabel && onAction) && !busy && state !== 'ready' && state !== 'cloud';
  return (
    <div data-state={state} className={cn('flex items-start gap-3', className)}>
      <span className="mt-0.5 shrink-0">
        <StateIcon state={state} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p
          role={state === 'error' ? 'alert' : 'status'}
          className={cn(
            'mt-0.5 text-sm leading-relaxed',
            state === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {modelStatusText(state, progress, sizeLabel)}
          {state === 'error' && errorText ? ` ${errorText}` : ''}
        </p>
        {state === 'downloading' || state === 'compiling' ? (
          <div
            role="progressbar"
            aria-label={title}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={state === 'compiling' ? 100 : percent}
            className="bg-muted mt-2 h-2 overflow-hidden rounded-full"
          >
            <div
              className={cn(
                'bg-primary h-full rounded-full transition-[width]',
                state === 'compiling' && 'animate-pulse',
              )}
              style={{ width: `${state === 'compiling' ? 100 : percent}%` }}
            />
          </div>
        ) : null}
        {showAction || secondary ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {showAction ? (
              <Button variant="outline" className="cursor-pointer" onClick={onAction}>
                {actionLabel}
              </Button>
            ) : null}
            {secondary}
          </div>
        ) : null}
      </div>
    </div>
  );
}
