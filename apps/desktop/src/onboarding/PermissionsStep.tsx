import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { currentOs, type DesktopOs } from '../lib/platform';

type PermissionName = keyof PermissionsStatus;
type PermissionState = PermissionsStatus[PermissionName];

const permissionLabels: Record<PermissionName, string> = {
  microphone: 'Micrô',
  systemAudio: 'Âm thanh hệ thống',
};

export function describePermission(
  name: PermissionName,
  state: PermissionState,
  os: DesktopOs = currentOs(),
) {
  const label = permissionLabels[name];

  // Windows has no permission for capturing what the speakers play, so there is nothing to grant.
  if (os === 'windows' && name === 'systemAudio') return 'Không cần cấp quyền.';
  if (state === 'granted') return `${label} đã được cấp quyền.`;
  if (state === 'denied') {
    return os === 'windows'
      ? `${label} đang bị từ chối. Mở Cài đặt Windows > Quyền riêng tư > Micrô để bật cho CueLingo.`
      : `${label} đang bị từ chối. Mở Cài đặt hệ thống > Quyền riêng tư & Bảo mật để cấp quyền cho CueLingo.`;
  }
  if (state === 'undetermined') {
    return os === 'windows'
      ? `Chưa xác định quyền ${label.toLocaleLowerCase('vi')}. Hãy bấm Bắt đầu để thử.`
      : name === 'microphone'
        ? 'Chưa xác định quyền micrô. Bấm Cho phép micro để macOS hỏi quyền.'
        : `Chưa xác định quyền ${label.toLocaleLowerCase('vi')}. Bấm Cho phép âm thanh hệ thống để macOS hỏi quyền.`;
  }
  return `Chưa kiểm tra được quyền ${label.toLocaleLowerCase('vi')}.`;
}

const checkText: Record<SystemAudioCheck, string> = {
  granted: 'Đã nghe được âm thanh hệ thống.',
  silent:
    'Không nghe thấy âm thanh. Hãy bật CueLingo trong mục Ghi âm thanh hệ thống, và kiểm tra loa không bị tắt tiếng.',
  error: 'Không thử được. Hãy khởi động lại CueLingo rồi thử lại.',
  unknown: 'Chưa kiểm tra được.',
};

const windowsSilentText =
  'Không nghe thấy âm thanh. Hãy kiểm tra thiết bị phát âm thanh mặc định của Windows, và loa không bị tắt tiếng.';

export const describeSystemAudioCheck = (result: SystemAudioCheck, os: DesktopOs = currentOs()) =>
  os === 'windows' && result === 'silent' ? windowsSilentText : checkText[result];

/** The button the microphone row shows: macOS asks itself while undetermined; otherwise Settings is the way. */
export function micAction(
  state: PermissionState,
  os: DesktopOs = currentOs(),
): 'allow' | 'settings' | null {
  if (state === 'granted') return null;
  if (state === 'undetermined' && os === 'macos') return 'allow';
  return 'settings';
}

/** What the person is told before testing the system audio. */
export const systemAudioIdleText = (os: DesktopOs = currentOs()) =>
  os === 'windows'
    ? 'Windows không đòi quyền riêng cho phần này. CueLingo thử bằng một tiếng chuông ngắn.'
    : 'macOS không cho biết trước quyền này, nên CueLingo thử bằng một tiếng chuông ngắn. Nếu macOS hỏi, hãy bấm Cho phép.';

function StateIcon({ state }: { state: PermissionState | SystemAudioCheck | 'checking' }) {
  if (state === 'checking') {
    return <Loader2 aria-hidden="true" className="text-muted-foreground size-5 animate-spin" />;
  }
  if (state === 'granted') {
    return <CheckCircle2 aria-hidden="true" className="text-success size-5" />;
  }
  if (state === 'denied' || state === 'silent' || state === 'error') {
    return <XCircle aria-hidden="true" className="text-destructive size-5" />;
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
  const os = currentOs();
  const settingsLabel = os === 'windows' ? 'Mở Cài đặt Windows' : 'Mở Cài đặt hệ thống';
  const permissions = useQuery({
    queryKey: ['desktop-permissions'],
    queryFn: native.permissionsStatus,
  });
  const queryClient = useQueryClient();
  const audio = useMutation({ mutationFn: native.checkSystemAudio });
  // macOS shows its own dialog; the answer replaces what the page knew.
  const askMic = useMutation({
    mutationFn: native.requestMicrophone,
    onSuccess: (status) => queryClient.setQueryData(['desktop-permissions'], status),
  });
  const mic = permissions.data?.microphone;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quyền truy cập</CardTitle>
        <CardDescription>
          {os === 'windows'
            ? 'CueLingo cần quyền Micrô để nghe giọng của bạn. Âm thanh hệ thống không cần cấp quyền.'
            : 'CueLingo cần hai quyền này để nghe cuộc họp.'}
        </CardDescription>
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
              {micAction(mic ?? 'unknown', os) === 'allow' ? (
                <Button
                  className="cursor-pointer"
                  disabled={askMic.isPending}
                  onClick={() => askMic.mutate()}
                >
                  {askMic.isPending ? 'Đang chờ bạn trả lời…' : 'Cho phép micro'}
                </Button>
              ) : null}
              {micAction(mic ?? 'unknown', os) === 'settings' ? (
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => void native.openUrl(PRIVACY_PANES.microphone)}
                >
                  {settingsLabel}
                </Button>
              ) : null}
            </Row>
            <Row
              state={audio.isPending ? 'checking' : (audio.data ?? 'unknown')}
              title="Âm thanh hệ thống"
              text={
                audio.isPending
                  ? 'Đang phát một tiếng chuông ngắn để thử… Nếu macOS hỏi, hãy bấm Cho phép.'
                  : audio.data
                    ? describeSystemAudioCheck(audio.data, os)
                    : systemAudioIdleText(os)
              }
            >
              <Button
                variant="outline"
                className="cursor-pointer"
                disabled={audio.isPending}
                onClick={() => audio.mutate()}
              >
                {audio.isPending
                  ? 'Đang thử…'
                  : os === 'windows'
                    ? 'Thử nghe âm thanh'
                    : 'Cho phép âm thanh hệ thống'}
              </Button>
              {audio.data !== 'granted' ? (
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => void native.openUrl(PRIVACY_PANES.systemAudio)}
                >
                  {os === 'windows' ? 'Mở cài đặt Âm thanh' : settingsLabel}
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
