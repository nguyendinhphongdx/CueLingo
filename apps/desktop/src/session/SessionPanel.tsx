import { Button as PressButton } from '@animate-ui/react/primitives/buttons/button';
import { Button } from '@cuelingo/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cuelingo/ui/components/card';
import { useSettings } from '../settings';
import { describeNativeError, openDebrief, toggleOverlay } from './session-actions';
import type { SessionStatus } from './session-controller';
import { useSession } from './use-session';

const statusText: Record<SessionStatus, string> = {
  idle: 'Chưa bắt đầu',
  connecting: 'Đang kết nối…',
  running: 'Đang chạy',
  reconnecting: 'Đang kết nối lại…',
  error: 'Có lỗi',
};

const statusTone: Record<SessionStatus, string> = {
  idle: 'bg-muted-foreground/40',
  connecting: 'animate-pulse bg-amber-500',
  running: 'bg-emerald-500',
  reconnecting: 'animate-pulse bg-amber-500',
  error: 'bg-red-500',
};

export function SessionStatus({ status }: { status: SessionStatus }) {
  return (
    <p aria-live="polite" className="flex items-center gap-2 text-sm">
      <span className={`size-2.5 rounded-full ${statusTone[status]}`} aria-hidden="true" />
      <span className="text-muted-foreground">Trạng thái:</span>
      <span className="text-foreground font-medium">{statusText[status]}</span>
    </p>
  );
}

export function DebriefButton({ sessionId }: { sessionId: string }) {
  return (
    <Button variant="outline" onClick={() => void openDebrief(sessionId)}>
      Xem debrief
    </Button>
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
        <CardTitle>Caption trực tiếp</CardTitle>
        <CardDescription>
          Bắt đầu để thấy caption và bản dịch tiếng Việt nổi trên màn hình.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SessionStatus status={session.status} />
        <div className="flex flex-wrap gap-2">
          {running ? (
            <Button
              size="lg"
              variant="destructive"
              disabled={busy}
              onClick={() => void session.stop()}
            >
              Dừng
            </Button>
          ) : (
            <PressButton asChild hoverScale={1} tapScale={0.97}>
              <Button size="lg" disabled={busy} onClick={() => void session.start(assistLevel)}>
                Bắt đầu
              </Button>
            </PressButton>
          )}
          <Button variant="outline" onClick={() => void toggleOverlay()}>
            Hiện/ẩn overlay
          </Button>
          {import.meta.env.DEV ? (
            <Button variant="outline" onClick={session.runDemo}>
              Chạy thử caption
            </Button>
          ) : null}
          {session.completedSessionId ? (
            <DebriefButton sessionId={session.completedSessionId} />
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
