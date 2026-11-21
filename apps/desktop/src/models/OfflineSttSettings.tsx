import { Badge } from '@cuelingo/ui/components/badge';
import { Button } from '@cuelingo/ui/components/button';
import { ListCard, Section } from '@cuelingo/ui/components/section';
import { ModelDownloadControl } from './ModelDownloadControl';
import type { ModelView } from './model-state';
import { useOfflineStt } from './use-offline-stt';

export function OfflineSttSettingsView({
  on,
  view,
  onToggle,
  onDownload,
}: {
  on: boolean;
  view: ModelView;
  onToggle(next: boolean): void;
  onDownload(): void;
}) {
  return (
    <Section
      title="Dự phòng khi mất mạng (tiếng Việt)"
      description="Họp tiếng Việt thường nhận dạng qua đám mây. Khi mất mạng hoặc hết giờ nhận dạng đám mây, CueLingo chuyển sang nhận dạng trên máy: câu nhận dạng trên máy không gửi âm thanh đi (CueLingo chỉ thỉnh thoảng thử lại đám mây bằng một câu), nhưng chất lượng thấp hơn, nhất là với thuật ngữ tiếng Anh. Tắt sẵn; bật thì tải mô hình một lần."
    >
      <ListCard>
        <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Tiếng Việt, ngoại tuyến</span>
            <Badge variant="outline">Trên máy</Badge>
          </div>
          <Button
            variant={on ? 'outline' : 'default'}
            className="cursor-pointer"
            aria-pressed={on}
            onClick={() => onToggle(!on)}
          >
            {on ? 'Tắt dự phòng' : 'Bật dự phòng'}
          </Button>
        </li>
        {on ? (
          <li className="px-4 py-3">
            <ModelDownloadControl
              view={view}
              name="tiếng Việt ngoại tuyến"
              onDownload={onDownload}
            />
          </li>
        ) : null}
      </ListCard>
    </Section>
  );
}

/** Settings section: the offline fallback for Vietnamese meetings (ADR 0024). Hidden where the build cannot run it. */
export function OfflineSttSettings() {
  const offline = useOfflineStt();
  if (!offline.loaded || !offline.available) return null;
  return (
    <OfflineSttSettingsView
      on={offline.on}
      view={offline.view}
      onToggle={offline.toggle}
      onDownload={offline.download}
    />
  );
}
