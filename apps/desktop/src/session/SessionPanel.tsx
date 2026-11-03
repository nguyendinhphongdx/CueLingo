import { Button as PressButton } from '@animate-ui/react/primitives/buttons/button';
import { Button } from '@cuelingo/ui/components/button';
import { ConfirmDialog } from '@cuelingo/ui/components/confirm-dialog';
import { LanguageSwitcher } from '@cuelingo/ui/components/language-switcher';
import { CloudUpload, Play, Square } from 'lucide-react';
import { LevelMeter } from '@cuelingo/ui/components/level-meter';
import { useEffect, useState } from 'react';
import { useMe } from '../auth';
import { useLanguage, useSettings } from '../settings';
import { grantCloudConsent, hasCloudConsent, setConsentUser } from './cloud-consent';
import { describeNativeError, openDebrief } from './session-actions';
import { PRIVACY_PANES, native } from '../lib/native';
import type { SessionStatus } from './session-controller';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@cuelingo/shared';
import { describeModelProgress, useModelProgress } from './model-progress';
import { debriefApi } from './debrief-api';
import { PostMeetingCard } from './PostMeetingCard';
import {
  decideStart,
  describeCaptureProblems,
  elapsedMs,
  formatDuration,
  meterNote,
  MIC_BLOCKED_BUTTON,
  MIC_BLOCKED_TEXT,
} from './capture-problems';
import type { AudioLevelSnapshot } from './audio-level-store';
import type { CaptureFailures } from './capture-problems';
import { useAudioLevels } from './use-audio-levels';
import { useDebriefBrief } from './use-debrief-brief';
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

export function DebriefButton({
  sessionId,
  label = 'Xem debrief',
}: {
  sessionId: string;
  label?: string;
}) {
  return (
    <Button variant="outline" onClick={() => void openDebrief(sessionId)}>
      {label}
    </Button>
  );
}

/** Meeting time from the controller's timestamps, so a reconnect or a drain does not distort it. */
function useMeetingDuration(startedAt: number | null, endedAt: number | null): string {
  const [, setTick] = useState(0);
  const ticking = startedAt !== null && endedAt === null;
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);
  return formatDuration(elapsedMs(startedAt, endedAt, Date.now()));
}

export const NO_SIGNAL_TEXT = 'Chưa có âm thanh';
export const CAPTURE_FAILED_TEXT = 'Không mở được';

/** The two meters. Silence only gets a soft note; a red label appears only for a capture the sidecar reported as failed. */
export function AudioLevelRows({
  levels,
  failures,
}: {
  levels: AudioLevelSnapshot;
  failures: CaptureFailures;
}) {
  const rows = [
    { label: 'Micro', values: levels.mic, silent: levels.micSilent, failed: failures.micFailed },
    {
      label: 'Âm thanh hệ thống',
      values: levels.system,
      silent: levels.systemSilent,
      failed: failures.systemFailed,
    },
  ];
  return (
    <div className="mt-4 grid max-w-md gap-2">
      {rows.map((row) => {
        const note = meterNote(row.failed, row.silent);
        return (
          <div key={row.label} className="flex items-center gap-3 text-sm">
            <span className="w-36 shrink-0 text-white/80">{row.label}</span>
            <LevelMeter levels={row.values} label={row.label} active={note === null} />
            {note === 'failed' ? (
              <span className="font-medium text-red-300">{CAPTURE_FAILED_TEXT}</span>
            ) : null}
            {note === 'silent' ? <span className="text-white/70">{NO_SIGNAL_TEXT}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

/** Warning for a capture that could not start; the meeting is not stopped. */
export function CaptureBanner({ failures }: { failures: CaptureFailures }) {
  const banner = describeCaptureProblems(failures);
  if (!banner) return null;
  return (
    <div
      role="alert"
      className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-red-500/25 px-3 py-2 text-sm"
    >
      <span className="mr-auto">{banner.message}</span>
      <Button
        size="sm"
        onClick={() => void native.openUrl(banner.pane)}
        className="cursor-pointer bg-white text-slate-900 hover:bg-white/90"
      >
        {banner.buttonLabel}
      </Button>
    </div>
  );
}

/** Shown instead of starting when macOS has the microphone blocked for CueLingo. */
export function MicBlockedNotice() {
  return (
    <div
      role="alert"
      className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
    >
      <span className="mr-auto">{MIC_BLOCKED_TEXT}</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => void native.openUrl(PRIVACY_PANES.microphone)}
        className="cursor-pointer"
      >
        {MIC_BLOCKED_BUTTON}
      </Button>
    </div>
  );
}

/** Both meters; mounted only while a meeting runs, which is when it listens. */
export function AudioLevels({ failures }: { failures: CaptureFailures }) {
  const levels = useAudioLevels(true);
  return <AudioLevelRows levels={levels} failures={failures} />;
}

export const CLOUD_CONSENT_TEXT =
  'Âm thanh cuộc họp (cả micro và âm thanh hệ thống) sẽ được gửi tới Google để nhận dạng giọng nói. Hãy báo trước cho người tham dự. CueLingo không lưu âm thanh.';
export const CLOUD_SWITCH_NOTE =
  'Ngôn ngữ này nhận dạng bằng đám mây: âm thanh sẽ được gửi tới Google.';
export const CLOUD_SENDING_TEXT = 'Đang gửi âm thanh tới Google để nhận dạng';

/** Whether the running meeting recognises speech in the cloud (never read from stored settings). */
export function isCloudMeeting(meetingLanguage: LanguageCode | null): boolean {
  return meetingLanguage !== null && SUPPORTED_LANGUAGES[meetingLanguage].recognition === 'cloud';
}

/** Shown for the whole time a cloud-language meeting runs: audio is leaving this machine. */
export function CloudSendingBadge() {
  return (
    <p
      role="status"
      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium"
    >
      <CloudUpload aria-hidden="true" className="size-4" />
      {CLOUD_SENDING_TEXT}
    </p>
  );
}

export function SessionPanel() {
  const { me } = useMe();
  const userId = me?.id ?? 'dev';
  setConsentUser(userId);
  const [askConsent, setAskConsent] = useState(false);
  const assistLevel = useSettings((state) => state.assistLevel);
  const { language, setLanguage, options } = useLanguage();
  const session = useSession();
  const running = session.status !== 'idle' && session.status !== 'error';
  const busy = session.status === 'connecting';
  const live = session.status === 'running';
  const duration = useMeetingDuration(session.startedAt, session.endedAt);
  const metering = live || session.status === 'reconnecting';
  const finishedId = running ? null : session.completedSessionId;
  // A meeting with no sentences has no debrief to wait for.
  const hasSentences = session.completedSegmentCount > 0;
  const brief = useDebriefBrief(hasSentences ? finishedId : null);
  const error = describeNativeError(session.error);
  // Consent is asked for the picker's language; the badge follows the meeting that really runs.
  const cloud = SUPPORTED_LANGUAGES[language].recognition === 'cloud';
  const sendsAudio = running && isCloudMeeting(session.meetingLanguage);
  const [micBlocked, setMicBlocked] = useState(false);
  // The microphone is checked first, so a blocked one never leads to a saved consent.
  // Set on the click itself: the permission check, the native stop and the cloud drain each take
  // a second or more, and the button must answer at once.
  const [pending, setPending] = useState<'starting' | 'stopping' | null>(null);
  const attempt = async () => {
    if (pending) return;
    setMicBlocked(false);
    setPending('starting');
    try {
      const decision = await decideStart({
        needsConsent: cloud && !hasCloudConsent(userId),
        readPermissions: native.permissionsStatus,
      });
      if (decision === 'mic-denied') setMicBlocked(true);
      else if (decision === 'ask-consent') setAskConsent(true);
      else begin();
    } finally {
      setPending(null);
    }
  };
  const halt = async () => {
    if (pending) return;
    setPending('stopping');
    try {
      await session.stop();
    } finally {
      setPending(null);
    }
  };
  const begin = () => void session.start(assistLevel, language);
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
          <p className={`mt-1 text-xs ${running ? 'text-white/70' : 'text-muted-foreground'}`}>
            Overlay tự hiện khi bắt đầu và ẩn khi dừng. ⌘⇧L để ẩn/hiện tay.
          </p>
        </div>
        {running && session.startedAt !== null ? (
          <p className="text-3xl font-light tabular-nums" aria-label="Thời gian đã chạy">
            {duration}
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
              disabled={busy || pending === 'stopping'}
              onClick={() => void halt()}
              className="cursor-pointer bg-white text-slate-900 hover:bg-white/90"
            >
              <Square aria-hidden="true" className="size-4 fill-current" />
              {pending === 'stopping' ? 'Đang dừng…' : 'Dừng'}
            </Button>
          </PressButton>
        ) : (
          <PressButton asChild hoverScale={1} tapScale={0.97}>
            <Button
              size="lg"
              disabled={busy || pending === 'starting'}
              onClick={() => void attempt()}
              className="cursor-pointer"
            >
              <Play aria-hidden="true" className="size-4 fill-current" />
              {pending === 'starting' ? 'Đang kiểm tra…' : 'Bắt đầu'}
            </Button>
          </PressButton>
        )}
      </div>
      {metering ? <AudioLevels failures={session} /> : null}
      {running ? <CaptureBanner failures={session} /> : null}
      {micBlocked ? <MicBlockedNotice /> : null}
      {finishedId ? (
        <PostMeetingCard
          duration={duration}
          sentences={session.completedSegmentCount}
          brief={brief}
          onOpen={() => void openDebrief(finishedId)}
          onComposeFollowup={(input) => debriefApi.followup(finishedId, input)}
        />
      ) : null}
      {sendsAudio ? <CloudSendingBadge /> : null}
      <ConfirmDialog
        open={askConsent}
        title="Gửi âm thanh để nhận dạng"
        confirmLabel="Đồng ý và bắt đầu"
        cancelLabel="Huỷ"
        onCancel={() => setAskConsent(false)}
        onConfirm={() => {
          setAskConsent(false);
          grantCloudConsent(userId);
          begin();
        }}
      >
        {CLOUD_CONSENT_TEXT}
      </ConfirmDialog>
      {modelProgress && busy ? (
        <p className="mt-4 text-sm text-white/80" aria-live="polite">
          {modelProgress}
        </p>
      ) : null}
      {session.suggestedLanguage ? (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm"
        >
          <span className="mr-auto">
            Nghe như {SUPPORTED_LANGUAGES[session.suggestedLanguage].name.toLowerCase()}. Đổi sang
            ngôn ngữ này?
            {SUPPORTED_LANGUAGES[session.suggestedLanguage].recognition === 'cloud' ? (
              <span className="mt-0.5 block text-xs text-white/70">{CLOUD_SWITCH_NOTE}</span>
            ) : null}
          </span>
          <Button
            size="sm"
            onClick={() => void session.acceptSuggestedLanguage()}
            className="cursor-pointer bg-white text-slate-900 hover:bg-white/90"
          >
            Đổi
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={session.dismissSuggestedLanguage}
            className="cursor-pointer text-white hover:bg-white/15 hover:text-white"
          >
            Bỏ qua
          </Button>
        </div>
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
