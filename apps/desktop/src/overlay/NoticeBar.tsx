import { Button } from '@cuelingo/ui/components/button';
import { AlertCircle, AlertTriangle, X } from 'lucide-react';
import type { NoticeEvent } from '../lib/native';

/** The one action that fixes a notice (for example "Nâng cấp"); none for a notice that only informs. */
export interface NoticeAction {
  label: string;
  onSelect(): void;
}

/**
 * Allowance messages above the captions, same tones as `NoticeStrip` (amber, then red). The overlay
 * is a see-through window, so each message sits on a solid card: the text stays `foreground` and only
 * the border and icon carry the tone, which reads on any meeting window behind.
 * Captions keep running underneath; each message can be dismissed.
 */
export function NoticeBar({
  notices,
  onDismiss,
  actionFor,
}: {
  notices: NoticeEvent[];
  onDismiss: (id: string) => void;
  actionFor?: (notice: NoticeEvent) => NoticeAction | undefined;
}) {
  if (notices.length === 0) return null;
  return (
    <div className="space-y-1.5 px-4 pb-2">
      {notices.map((notice) => {
        const error = notice.tone === 'error';
        const action = actionFor?.(notice);
        const Icon = error ? AlertCircle : AlertTriangle;
        return (
          <div
            key={notice.id}
            role={error ? 'alert' : 'status'}
            data-tone={notice.tone}
            className={`bg-card text-foreground flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              error ? 'border-destructive' : 'border-warning'
            }`}
          >
            <Icon
              aria-hidden="true"
              className={`size-4 shrink-0 ${error ? 'text-destructive' : 'text-warning'}`}
            />
            <span className="min-w-0 flex-1">{notice.text}</span>
            {action ? (
              <Button size="sm" variant="secondary" onClick={action.onSelect}>
                {action.label}
              </Button>
            ) : null}
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => onDismiss(notice.id)}
              className="focus-visible:ring-ring text-muted-foreground hover:text-foreground -mr-1 shrink-0 cursor-pointer rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
