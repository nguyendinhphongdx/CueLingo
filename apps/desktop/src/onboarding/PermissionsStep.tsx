import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@cuelingo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';
import { CheckCircle2, CircleHelp, Loader2, XCircle } from 'lucide-react';
import {
  native,
  PRIVACY_PANES,
  type PermissionsStatus,
  type SystemAudioCheck,
} from '../lib/native';

type PermissionName = keyof PermissionsStatus;
type PermissionState = PermissionsStatus[PermissionName];

const permissionLabels: Record<PermissionName, string> = {
  microphone: 'Micrô',
  systemAudio: 'Âm thanh hệ thống',
};

export function describePermission(name: PermissionName, state: PermissionState) {
  const label = permissionLabels[name];

  if (state === 'granted') return `${label} đã được cấp quyền.`;
  if (state === 'denied') {
    return `${label} đang bị từ chối. Mở Cài đặt hệ thống > Quyền riêng tư & Bảo mật để cấp quyền cho CueLingo.`;
  }
  if (state === 'undetermined') {
    return `Chưa xác định quyền ${label.toLocaleLowerCase('vi')}. macOS sẽ hỏi khi bạn bấm Bắt đầu lần đầu.`;
  }
  return `Chưa kiểm tra được quyền ${label.toLocaleLowerCase('vi')}.`;
}

const checkText: Record<SystemAudioCheck, string> = {
  granted: 'CueLingo nghe được âm thanh hệ thống.',
  silent:
    'Không nghe thấy âm thanh. Hãy bật CueLingo trong mục Ghi âm thanh hệ thống, và kiểm tra loa không bị tắt tiếng.',
  error: 'Không thử được. Hãy khởi động lại CueLingo rồi thử lại.',
  unknown: 'Chưa kiểm tra được.',
};

function StateIcon({ state }: { state: PermissionState | SystemAudioCheck | 'checking' }) {
  if (state === 'checking') {
    return <Loader2 aria-hidden="true" className="text-muted-foreground size-5 animate-spin" />;
  }
  if (state === 'granted') {
    return (
      <CheckCircle2 aria-hidden="true" className="size-5 text-emerald-600 dark:text-emerald-400" />
    );
  }
  if (state === 'denied' || state === 'silent' || state === 'error') {
    return <XCircle aria-hidden="true" className="size-5 text-red-600 dark:text-red-400" />;
  }
  return <CircleHelp aria-hidden="true" className="text-muted-foreground size-5" />;
}

function Row({
  state,
  title,
  text,
  children,
}: {
  state: PermissionState | SystemAudioCheck | 'checking';
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
      <span className="mt-0.5 shrink-0">
        <StateIcon state={state} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">{text}</p>
        {children ? <div className="mt-3 flex flex-wrap gap-2">{children}</div> : null}
      </div>
    </li>
  );
}

export function PermissionsStatusView({ status }: { status: PermissionsStatus }) {
  return (
    <ul className="divide-y">
      {(['microphone', 'systemAudio'] as const).map((name) => (
        <Row
          key={name}
          state={status[name]}
          title={permissionLabels[name]}
          text={describePermission(name, status[name])}
        />
      ))}
    </ul>
  );
}

export function PermissionsStep() {
  const permissions = useQuery({
    queryKey: ['desktop-permissions'],
    queryFn: native.permissionsStatus,
  });
  const audio = useMutation({ mutationFn: native.checkSystemAudio });
  const mic = permissions.data?.microphone;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quyền truy cập</CardTitle>
        <CardDescription>CueLingo cần hai quyền này để nghe cuộc họp.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {permissions.isPending ? (
          <p className="text-muted-foreground text-sm">Đang kiểm tra quyền…</p>
        ) : permissions.error ? (
          <p role="alert" className="text-destructive text-sm">
            Không thể kiểm tra quyền. Vui lòng thử lại.
          </p>
        ) : (
          <ul className="divide-y">
            <Row
              state={permissions.data.microphone}
              title="Micrô"
              text={describePermission('microphone', permissions.data.microphone)}
            >
              {mic === 'denied' ? (
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => void native.openUrl(PRIVACY_PANES.microphone)}
                >
                  Mở Cài đặt hệ thống
                </Button>
              ) : null}
            </Row>
            <Row
              state={audio.isPending ? 'checking' : (audio.data ?? 'unknown')}
              title="Âm thanh hệ thống"
              text={
                audio.isPending
                  ? 'Đang phát một tiếng chuông ngắn để thử…'
                  : audio.data
                    ? checkText[audio.data]
                    : 'macOS không cho biết trước quyền này, nên CueLingo thử bằng một tiếng chuông ngắn.'
              }
            >
              <Button
                variant="outline"
                className="cursor-pointer"
                disabled={audio.isPending}
                onClick={() => audio.mutate()}
              >
                {audio.isPending ? 'Đang thử…' : 'Thử nghe âm thanh'}
              </Button>
              {audio.data === 'silent' ? (
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => void native.openUrl(PRIVACY_PANES.systemAudio)}
                >
                  Mở Cài đặt hệ thống
                </Button>
              ) : null}
            </Row>
          </ul>
        )}
        <Button
          variant="ghost"
          className="cursor-pointer"
          onClick={() => void permissions.refetch()}
          disabled={permissions.isFetching}
        >
          Kiểm tra lại micrô
        </Button>
      </CardContent>
    </Card>
  );
}
