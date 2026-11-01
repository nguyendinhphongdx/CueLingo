import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleHelp, XCircle } from 'lucide-react';
import { Button } from '@cuelingo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';
import { native, type PermissionsStatus } from '../lib/native';

type PermissionName = keyof PermissionsStatus;
type PermissionState = PermissionsStatus[PermissionName];

const permissionLabels: Record<PermissionName, string> = {
  microphone: 'Micrô',
  screenCapture: 'Ghi màn hình',
};

export function describePermission(name: PermissionName, state: PermissionState) {
  const label = permissionLabels[name];

  if (state === 'granted') return `${label} đã được cấp quyền.`;
  if (state === 'denied') {
    return `${label} đang bị từ chối. Mở Cài đặt hệ thống > Quyền riêng tư & Bảo mật để cấp quyền cho CueLingo.`;
  }
  return `Chưa xác định quyền ${label.toLocaleLowerCase('vi')}. macOS sẽ hỏi quyền khi bạn bấm Bắt đầu lần đầu; nếu đã từ chối, mở Cài đặt hệ thống > Quyền riêng tư & Bảo mật.`;
}

export function PermissionsStatusView({ status }: { status: PermissionsStatus }) {
  const ready = status.microphone === 'granted' && status.screenCapture === 'granted';

  if (ready) {
    return <p className="text-sm font-medium">Micrô và ghi màn hình đã sẵn sàng.</p>;
  }

  return (
    <ul className="divide-y">
      {(['microphone', 'screenCapture'] as const).map((name) => {
        const state = status[name];
        const Icon = state === 'granted' ? CheckCircle2 : state === 'denied' ? XCircle : CircleHelp;
        const tone =
          state === 'granted'
            ? 'text-emerald-600 dark:text-emerald-400'
            : state === 'denied'
              ? 'text-red-600 dark:text-red-400'
              : 'text-muted-foreground';
        return (
          <li key={name} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${tone}`} />
            <p className="text-sm leading-relaxed">{describePermission(name, state)}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function PermissionsStep() {
  const permissions = useQuery({
    queryKey: ['desktop-permissions'],
    queryFn: native.permissionsStatus,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quyền truy cập</CardTitle>
        <CardDescription>CueLingo cần các quyền này để nghe và hiển thị caption.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {permissions.isPending ? (
          <p className="text-muted-foreground text-sm">Đang kiểm tra quyền…</p>
        ) : permissions.error ? (
          <p role="alert" className="text-destructive text-sm">
            Không thể kiểm tra quyền. Vui lòng thử lại.
          </p>
        ) : (
          <PermissionsStatusView status={permissions.data} />
        )}
        <Button
          variant="outline"
          className="cursor-pointer"
          onClick={() => void permissions.refetch()}
          disabled={permissions.isFetching}
        >
          Kiểm tra lại
        </Button>
      </CardContent>
    </Card>
  );
}
