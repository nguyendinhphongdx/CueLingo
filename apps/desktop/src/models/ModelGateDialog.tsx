import { ConfirmDialog } from '@cuelingo/ui/components/confirm-dialog';
import { ModelDownloadControl } from './ModelDownloadControl';
import { formatSize, type ModelView } from './model-state';

/**
 * Shown when the person starts a meeting whose model is not on this machine: the model comes down here, in
 * view, and the meeting starts by itself once it is in place (instead of a silent download behind a meeting
 * that shows nothing). Presentation only; `use-meeting-controls` decides when it opens and closes.
 */
export function ModelGateDialog({
  open,
  languageName,
  view,
  onDownload,
  onCancelDownload,
  onRestart,
  onClose,
}: {
  open: boolean;
  /** "tiếng anh", already lower case. */
  languageName: string;
  view: ModelView | null;
  onDownload(): void;
  /** ✕: stops the download but keeps this dialog, so the person can start it again. */
  onCancelDownload(): void;
  /** Reload: stops and starts the download again. */
  onRestart(): void;
  /** "Huỷ": closes the dialog and gives up on starting the meeting; a running download goes on in the background. */
  onClose(): void;
}) {
  const size =
    view && 'sizeBytes' in view && view.sizeBytes > 0 ? ` (${formatSize(view.sizeBytes)})` : '';
  return (
    <ConfirmDialog
      open={open}
      title="Cần tải mô hình nhận dạng"
      cancelLabel="Huỷ"
      onCancel={onClose}
    >
      <p>
        Cuộc họp bằng {languageName} dùng mô hình chạy ngay trên máy bạn{size}. Tải xong, cuộc họp
        sẽ tự bắt đầu.
      </p>
      {view ? (
        <div className="mt-4">
          <ModelDownloadControl
            view={view}
            name={languageName}
            onDownload={onDownload}
            onCancel={onCancelDownload}
            onRestart={onRestart}
          />
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
