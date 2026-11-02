import { Button as PressButton } from '@animate-ui/react/primitives/buttons/button';
import { Button } from '@cuelingo/ui/components/button';
import { LanguageSwitcher } from '@cuelingo/ui/components/language-switcher';
import { PictureInPicture2, Play, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage, useSettings } from '../settings';
import { describeNativeError, openDebrief, toggleOverlay } from './session-actions';
import type { SessionStatus } from './session-controller';
import { describeModelProgress, useModelProgress } from './model-progress';
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

/** Elapsed time of the running session as mm:ss or h:mm:ss. */
function useElapsed(active: boolean): string {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [active]);
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(seconds / 3600);
  const rest = `${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
  return hours > 0 ? `${hours}:${rest}` : rest;
}

export function SessionPanel() {
  const assistLevel = useSettings((state) => state.assistLevel);
  const { language, setLanguage, options } = useLanguage();
  const session = useSession();
  const running = session.status !== 'idle' && session.status !== 'error';
  const busy = session.status === 'connecting';
  const live = session.status === 'running';
  const elapsed = useElapsed(live);
  const error = describeNativeError(session.error);
  const modelProgress = describeModelProgress(useModelProgress());

  return (
    <section
      aria-label="Caption trực tiếp"
      className={`relative overflow-hidden rounded-2xl border p-6 transition-colors ${
        running ? 'surface-live border-transparent text-white' : 'bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p
            className={`flex items-center gap-2 text-sm font-medium ${
              running ? 'text-white/80' : 'text-muted-foreground'
            }`}
          >
            <span className="relative flex size-2.5" aria-hidden="true">
              {live ? (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
              ) : null}
              <span
                className={`relative inline-flex size-2.5 rounded-full ${
                  running ? 'bg-white' : statusTone[session.status]
                }`}
              />
            </span>
            {statusText[session.status]}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            {live ? 'Đang nghe cuộc họp' : running ? 'Đang chuẩn bị…' : 'Sẵn sàng khi bạn cần'}
          </h2>
          <p className={`mt-1.5 text-sm ${running ? 'text-white/80' : 'text-muted-foreground'}`}>
            {live
              ? 'Caption và bản dịch đang hiện trên overlay nổi.'
              : 'Bấm bắt đầu rồi mở Zoom, Meet hoặc Teams như bình thường.'}
          </p>
        </div>
        {live ? (
          <p className="text-3xl font-light tabular-nums" aria-label="Thời gian đã chạy">
            {elapsed}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {running ? null : (
          <LanguageSwitcher options={options} value={language} onChange={setLanguage} />
        )}
        {running ? (
          <PressButton asChild hoverScale={1} tapScale={0.97}>
            <Button
              size="lg"
              disabled={busy}
              onClick={() => void session.stop()}
              className="cursor-pointer bg-white text-slate-900 hover:bg-white/90"
            >
              <Square aria-hidden="true" className="size-4 fill-current" />
              Dừng
            </Button>
          </PressButton>
        ) : (
          <PressButton asChild hoverScale={1} tapScale={0.97}>
            <Button
              size="lg"
              disabled={busy}
              onClick={() => void session.start(assistLevel, language)}
              className="cursor-pointer"
            >
              <Play aria-hidden="true" className="size-4 fill-current" />
              Bắt đầu
            </Button>
          </PressButton>
        )}
        <Button
          variant={running ? 'ghost' : 'outline'}
          size="lg"
          onClick={() => void toggleOverlay()}
          className={`cursor-pointer ${running ? 'text-white hover:bg-white/15 hover:text-white' : ''}`}
        >
          <PictureInPicture2 aria-hidden="true" className="size-4" />
          Hiện/ẩn overlay
        </Button>
        {import.meta.env.DEV ? (
          <Button variant="ghost" size="lg" onClick={session.runDemo} className="cursor-pointer">
            Chạy thử caption
          </Button>
        ) : null}
        {session.completedSessionId ? (
          <DebriefButton sessionId={session.completedSessionId} />
        ) : null}
      </div>
      {modelProgress && busy ? (
        <p className="mt-4 text-sm text-white/80" aria-live="polite">
          {modelProgress}
        </p>
      ) : null}
      <div className="sr-only" aria-live="polite">
        Trạng thái: {statusText[session.status]}
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
