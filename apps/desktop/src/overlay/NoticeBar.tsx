import { X } from 'lucide-react';
import type { NoticeEvent } from '../lib/native';

/** Allowance messages above the captions. Captions keep running underneath; each message can be dismissed. */
export function NoticeBar({
  notices,
  onDismiss,
}: {
  notices: NoticeEvent[];
  onDismiss: (id: string) => void;
}) {
  if (notices.length === 0) return null;
  return (
    <div className="space-y-1.5 px-4 pb-2">
      {notices.map((notice) => (
        <div
          key={notice.id}
          role="status"
          data-tone={notice.tone}
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
            notice.tone === 'error'
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : 'border-warning/40 bg-warning/10 text-warning'
          }`}
        >
          <span className="min-w-0 flex-1">{notice.text}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => onDismiss(notice.id)}
            className="focus-visible:ring-ring -mr-1 shrink-0 cursor-pointer rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
