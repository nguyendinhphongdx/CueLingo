import { useUpdater } from './use-updater';

export interface UpdateBannerViewProps {
  state: ReturnType<typeof useUpdater>['state'];
  locked: boolean;
  onInstall(): void;
  onDismiss(): void;
}

/** What the person sees when a newer build exists. Pure markup so it can be tested. */
export function UpdateBannerView({ state, locked, onInstall, onDismiss }: UpdateBannerViewProps) {
  if (state.phase === 'none') return null;
  const box =
    'bg-card mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm';
  const button =
    'bg-primary text-primary-foreground min-h-9 cursor-pointer rounded-lg px-3 disabled:cursor-not-allowed disabled:opacity-50';

  if (state.phase === 'installing') {
    return (
      <div role="status" className={box}>
        Đang cập nhật lên {state.version}… CueLingo sẽ tự mở lại.
      </div>
    );
  }
  if (state.phase === 'failed') {
    return (
      <div role="alert" className={box}>
        <span>
          {state.reason === 'signature'
            ? 'Không cài được bản mới vì chữ ký gói cập nhật không khớp. Hãy tải lại bản mới nhất từ trang tải về.'
            : 'Không cập nhật được lúc này. Bạn thử lại sau hoặc tải bản mới từ trang tải về.'}
        </span>
        <button type="button" className={button} onClick={onDismiss}>
          Đóng
        </button>
      </div>
    );
  }
  return (
    <div role="status" className={box}>
      <span>
        Có bản mới {state.version}.
        {locked ? ' Cập nhật sau khi họp xong, vì app sẽ tự mở lại.' : ''} Sau khi cập nhật, macOS
        có thể hỏi lại quyền micro và ghi âm hệ thống.
      </span>
      <button type="button" className={button} disabled={locked} onClick={onInstall}>
        Cập nhật
      </button>
    </div>
  );
}

export function UpdateBanner() {
  const { state, locked, install, dismiss } = useUpdater();
  return <UpdateBannerView state={state} locked={locked} onInstall={install} onDismiss={dismiss} />;
}
