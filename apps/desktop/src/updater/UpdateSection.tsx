import { Button } from '@cuelingo/ui/components/button';
import type { ManualCheck, UpdateState } from './update-controller';
import { useUpdateStatus } from './use-updater';

export interface UpdateSectionViewProps {
  version: string;
  state: UpdateState;
  manual: ManualCheck;
  locked: boolean;
  onCheck(): void;
  onInstall(): void;
}

const time = (at: Date) => at.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

function statusText({ state, manual, locked }: UpdateSectionViewProps): string {
  if (state.phase === 'installing')
    return `Đang cập nhật lên ${state.version}… CueLingo sẽ tự mở lại.`;
  if (state.phase === 'failed') {
    return state.reason === 'signature'
      ? 'Không cài được bản mới vì chữ ký gói cập nhật không khớp. Hãy tải lại bản mới nhất từ trang tải về.'
      : 'Không cập nhật được lúc này. Bạn thử lại sau hoặc tải bản mới từ trang tải về.';
  }
  if (state.phase === 'available') {
    return locked
      ? `Có bản mới ${state.version}. Cập nhật sau khi họp xong, vì app sẽ tự mở lại.`
      : `Có bản mới ${state.version}.`;
  }
  switch (manual.status) {
    case 'checking':
      return 'Đang kiểm tra…';
    case 'upToDate':
      return `Bạn đang dùng bản mới nhất (kiểm tra lúc ${time(manual.at)}).`;
    case 'unsupported':
      return 'Bản này không tự cập nhật. Tải bản mới từ trang tải về.';
    case 'error':
      return 'Không kiểm tra được, thử lại sau.';
    default:
      return 'App tự kiểm tra bản mới khi mở và mỗi 6 giờ.';
  }
}

/** Version and update controls in Settings. Pure markup so it can be tested. */
export function UpdateSectionView(props: UpdateSectionViewProps) {
  const { version, state, manual, locked, onCheck, onInstall } = props;
  const busy = manual.status === 'checking' || state.phase === 'installing';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Phiên bản {version}</p>
        <p role="status" className="text-muted-foreground mt-0.5 text-sm">
          {statusText(props)}
        </p>
      </div>
      {state.phase === 'available' ? (
        <Button className="shrink-0" disabled={locked} onClick={onInstall}>
          Cập nhật
        </Button>
      ) : (
        <Button variant="outline" className="shrink-0" disabled={busy} onClick={onCheck}>
          Kiểm tra cập nhật
        </Button>
      )}
    </div>
  );
}

export function UpdateSection({ version }: { version: string }) {
  const { state, manual, locked, checkNow, install } = useUpdateStatus();
  return (
    <UpdateSectionView
      version={version}
      state={state}
      manual={manual}
      locked={locked}
      onCheck={() => void checkNow()}
      onInstall={() => void install()}
    />
  );
}
