import { Button } from '@cuelingo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';
import { useSettings } from '../settings';
import { describeNativeError, toggleOverlay } from './session-actions';
import type { SessionStatus } from './session-controller';
import { useSession } from './use-session';

const statusText: Record<SessionStatus, string> = {
  idle: 'Chưa bắt đầu',
  connecting: 'Đang kết nối…',
  running: 'Đang chạy',
  reconnecting: 'Đang kết nối lại…',
  error: 'Có lỗi',
};

export function SessionStatus({ status }: { status: SessionStatus }) {
  return (
    <p aria-live="polite" className="text-muted-foreground text-sm">
      Trạng thái: <span className="text-foreground font-medium">{statusText[status]}</span>
    </p>
  );
}

export function SessionPanel() {
  const assistLevel = useSettings((state) => state.assistLevel);
  const session = useSession();
  const running = session.status !== 'idle' && session.status !== 'error';
  const busy = session.status === 'connecting';
  const error = describeNativeError(session.error);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Phiên họp</CardTitle>
        <CardDescription>Bắt đầu caption hoặc điều khiển cửa sổ overlay.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SessionStatus status={session.status} />
        <div className="flex flex-wrap gap-2">
          {running ? (
            <Button variant="destructive" disabled={busy} onClick={() => void session.stop()}>
              Dừng
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => void session.start(assistLevel)}>
              Bắt đầu
            </Button>
          )}
          <Button variant="outline" onClick={() => void toggleOverlay()}>
            Hiện/ẩn overlay
          </Button>
          {import.meta.env.DEV ? (
            <Button variant="outline" onClick={session.runDemo}>
              Chạy thử caption
            </Button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
        <dl className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="sr-only">Hiện hoặc ẩn overlay</dt>
            <dd>⌘⇧L · Overlay</dd>
          </div>
          <div>
            <dt className="sr-only">Tóm tắt</dt>
            <dd>⌘⇧W · Tóm tắt</dd>
          </div>
          <div>
            <dt className="sr-only">Nói giúp</dt>
            <dd>⌘⇧S · Nói giúp</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
