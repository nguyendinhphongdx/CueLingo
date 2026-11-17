import { Badge } from '@cuelingo/ui/components/badge';
import { Button } from '@cuelingo/ui/components/button';
import { Progress } from '@cuelingo/ui/components/progress';
import { IconButton } from '@cuelingo/ui/components/icon-button';
import { Download, RotateCw, X } from 'lucide-react';
import { formatSize, type ModelView } from './model-state';

/** The state of one model and the one action that fits it: download, wait, or try again. Presentation only. */
export function ModelDownloadControl({
  view,
  name,
  onDownload,
  onCancel,
  onRestart,
}: {
  view: ModelView;
  /** What the model recognises, for screen readers ("tiếng Anh"). */
  name: string;
  onDownload(): void;
  /** ✕ while downloading: stop. Left out where stopping makes no sense. */
  onCancel?(): void;
  /** Reload while downloading: stop and start again, for a download that failed half way or seems stuck. */
  onRestart?(): void;
}) {
  switch (view.kind) {
    case 'cloud':
      return <p className="text-muted-foreground text-sm">Không cần tải mô hình.</p>;
    case 'checking':
      return <p className="text-muted-foreground text-sm">Đang kiểm tra…</p>;
    case 'ready':
      return <Badge variant="success">Đã sẵn sàng</Badge>;
    case 'missing':
      return (
        <Button onClick={onDownload}>
          <Download aria-hidden="true" className="size-4" />
          Tải mô hình ngay · {formatSize(view.sizeBytes)}
        </Button>
      );
    case 'downloading': {
      const percent = Math.round(view.progress * 100);
      return (
        <div className="flex w-full max-w-md items-start gap-2">
          <div className="min-w-0 grow space-y-1.5">
            <Progress
              value={view.progress}
              label={`Tải mô hình ${name}`}
              valueText={`Đang tải ${percent}%`}
            />
            <p className="text-muted-foreground text-sm">
              Đang tải… {percent}% · {formatSize(view.sizeBytes)}
            </p>
          </div>
          {onRestart ? (
            <IconButton
              label="Tải lại"
              icon={<RotateCw aria-hidden="true" className="size-4" />}
              onClick={onRestart}
            />
          ) : null}
          {onCancel ? (
            <IconButton
              label="Hủy tải"
              icon={<X aria-hidden="true" className="size-4" />}
              onClick={onCancel}
            />
          ) : null}
        </div>
      );
    }
    case 'error':
      return (
        <div className="space-y-2">
          <p role="alert" className="text-destructive text-sm">
            {view.message}
          </p>
          <Button variant="outline" onClick={onDownload}>
            Thử lại
          </Button>
        </div>
      );
  }
}
