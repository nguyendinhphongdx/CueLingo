import { Button as PressButton } from '@animate-ui/react/primitives/buttons/button';
import { Badge } from '@cuelingo/ui/components/badge';
import { Button } from '@cuelingo/ui/components/button';
import { ConfirmDialog } from '@cuelingo/ui/components/confirm-dialog';
import { ModelGateDialog } from '../models/ModelGateDialog';
import { LanguageSwitcher } from '@cuelingo/ui/components/language-switcher';
import { LevelMeter } from '@cuelingo/ui/components/level-meter';
import { CloudUpload, Mic, Play, Square, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../settings';
import { describeNativeError, openDebrief } from './session-actions';
import { native } from '../lib/native';
import { shortcutLabel } from '../lib/platform';
import type { LatestCaption, SessionStatus as Status } from './session-controller';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@cuelingo/shared';
import { describeModelProgress, useModelProgress } from './model-progress';
import { debriefApi } from './debrief-api';
import { PostMeetingCard } from './PostMeetingCard';
import {
  describeStream,
  elapsedMs,
  formatDuration,
  meterNote,
  type CaptureStream,
} from './capture-problems';
import type { AudioLevelSnapshot } from './audio-level-store';
import type { CaptureFailures } from './capture-problems';
import { startLabel } from './readiness';
import { ReadinessList } from './ReadinessList';
import type { MeetingControls } from './use-meeting-controls';
import { useAudioLevels } from './use-audio-levels';
import { useDebriefBrief } from './use-debrief-brief';
import { useReadiness } from './use-readiness';
import { useSession } from './use-session';

const statusText: Record<Status, string> = {
  idle: 'Chưa bắt đầu',
  connecting: 'Đang kết nối…',
  running: 'Đang chạy',
  reconnecting: 'Đang kết nối lại…',
  error: 'Có lỗi',
};

const statusTone: Record<Status, string> = {
  idle: 'bg-muted-foreground/40',
  connecting: 'animate-pulse bg-warning',
  running: 'bg-success',
  reconnecting: 'animate-pulse bg-warning',
  error: 'bg-destructive',
};

export function SessionStatus({ status }: { status: Status }) {
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
export const LISTENING_TEXT = 'Đang nghe';

const STREAMS: { stream: CaptureStream; label: string; icon: typeof Mic }[] = [
  { stream: 'system', label: 'Âm thanh hệ thống', icon: Volume2 },
  { stream: 'mic', label: 'Micro', icon: Mic },
];

/**
 * One card per stream, each with its own meter and state: a stream that failed shows its own fix and
 * the other keeps listening. Silence only gets a soft note; a fault shows only for a capture the
 * sidecar reported as failed.
 */
export function AudioLevelRows({
  levels,
  failures,
}: {
  levels: AudioLevelSnapshot;
  failures: CaptureFailures;
}) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {STREAMS.map(({ stream, label, icon: Icon }) => {
        const failed = stream === 'mic' ? failures.micFailed : failures.systemFailed;
        const silent = stream === 'mic' ? levels.micSilent : levels.systemSilent;
        const note = meterNote(failed, silent);
        const problem = describeStream(stream, failures);
        return (
          <div
            key={stream}
            data-stream={stream}
            data-state={note ?? 'listening'}
            className="flex flex-col gap-2 rounded-lg bg-white/15 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span className="grow text-sm font-medium">{label}</span>
              <LevelMeter
                levels={stream === 'mic' ? levels.mic : levels.system}
                label={label}
                active={note === null}
                className="w-24 shrink-0"
              />
            </div>
            {note === 'failed' ? (
              <div role="alert" className="flex flex-wrap items-center gap-2 text-xs">
                <span className="grow font-semibold">{CAPTURE_FAILED_TEXT}</span>
                {problem ? (
                  <Button
                    size="sm"
                    onClick={() => void native.openUrl(problem.pane)}
                    className="text-brand cursor-pointer bg-white hover:bg-white/90"
                  >
                    {problem.buttonLabel}
                  </Button>
                ) : null}
                {problem ? <p className="basis-full opacity-85">{problem.message}</p> : null}
              </div>
            ) : (
              <p className="text-xs opacity-85">
                {note === 'silent' ? NO_SIGNAL_TEXT : LISTENING_TEXT}
              </p>
            )}
          </div>
        );
      })}
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

export const LATEST_CAPTION_HINT = 'Chỉ để xem nhanh. Bản đầy đủ nằm trong cửa sổ caption.';
export const LATEST_CAPTION_WAITING = 'Chưa có câu nào. Câu đầu tiên sẽ hiện ở đây.';

/** The newest finished sentence with its translation; the full captions stay in the overlay. */
export function LatestCaptionCard({ caption }: { caption: LatestCaption | null }) {
  return (
    <section aria-labelledby="latest-caption-title" className="bg-card rounded-2xl border p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="latest-caption-title" className="text-base font-semibold">
          Câu mới nhất
        </h2>
        <p className="text-muted-foreground text-xs">{LATEST_CAPTION_HINT}</p>
      </div>
      {caption ? (
        <div className="mt-3 space-y-1">
          <p className="text-muted-foreground text-xs font-medium">{caption.speaker}</p>
          <p className="text-base">{caption.text}</p>
          {caption.translation ? (
            <p className="text-muted-foreground text-sm">{caption.translation}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground mt-3 text-sm">{LATEST_CAPTION_WAITING}</p>
      )}
    </section>
  );
}

/** The ready state: language, readiness of each input with its own fix, and the Start button. */
function IdleCard({ controls }: { controls: MeetingControls }) {
  const { language, setLanguage, options } = useLanguage();
  const { items, fix } = useReadiness(language, () => void controls.attempt());
  const starting = controls.pending === 'starting';
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Sẵn sàng khi bạn cần</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Bấm bắt đầu rồi mở Zoom, Meet hoặc Teams như bình thường.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Ngôn ngữ đang nghe</span>
        <LanguageSwitcher options={options} value={language} onChange={setLanguage} />
      </div>
      <ReadinessList items={items} onFix={fix} />
      <div className="flex flex-wrap items-center gap-4">
        <PressButton asChild hoverScale={1} tapScale={0.97}>
          <Button
            size="lg"
            disabled={starting}
            onClick={() => void controls.attempt()}
            className="min-w-56 cursor-pointer"
          >
            <Play aria-hidden="true" className="size-4 fill-current" />
            {starting ? 'Đang kiểm tra…' : startLabel(items)}
          </Button>
        </PressButton>
        <p className="text-muted-foreground text-xs">
          Overlay tự hiện khi bắt đầu và ẩn khi dừng. {shortcutLabel('L')} để ẩn/hiện tay.
        </p>
      </div>
    </div>
  );
}

export function SessionPanel({ controls }: { controls: MeetingControls }) {
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
  const sendsAudio = running && isCloudMeeting(session.meetingLanguage);
  const modelProgress = describeModelProgress(useModelProgress());

  return (
    <>
      <section
        aria-label="Caption trực tiếp"
        className={`relative overflow-hidden rounded-2xl border p-6 transition-colors ${
          running ? 'surface-live border-transparent text-white' : 'bg-card'
        }`}
      >
        {running ? (
          <>
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <Badge className="bg-white/20 text-white">
                  <span className="relative flex size-2" aria-hidden="true">
                    {live ? (
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
                    ) : null}
                    <span className="relative inline-flex size-2 rounded-full bg-white" />
                  </span>
                  {statusText[session.status]}
                </Badge>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                  {live ? 'Đang nghe cuộc họp' : 'Đang chuẩn bị…'}
                </h2>
                <p className="mt-1.5 text-sm text-white/80">
                  {live
                    ? 'Caption và bản dịch đang hiện trên overlay nổi.'
                    : 'Bấm bắt đầu rồi mở Zoom, Meet hoặc Teams như bình thường.'}
                </p>
                <p className="mt-1 text-xs text-white/70">
                  Overlay tự hiện khi bắt đầu và ẩn khi dừng. {shortcutLabel('L')} để ẩn/hiện tay.
                </p>
              </div>
              {session.startedAt !== null ? (
                <p className="font-mono text-3xl tabular-nums" aria-label="Thời gian đã chạy">
                  {duration}
                </p>
              ) : null}
            </div>
            {metering ? <AudioLevels failures={session} /> : null}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <PressButton asChild hoverScale={1} tapScale={0.97}>
                <Button
                  size="lg"
                  disabled={busy || controls.pending === 'stopping'}
                  onClick={() => void controls.halt()}
                  className="text-brand cursor-pointer bg-white hover:bg-white/90"
                >
                  <Square aria-hidden="true" className="size-4 fill-current" />
                  {controls.pending === 'stopping' ? 'Đang dừng…' : 'Dừng'}
                </Button>
              </PressButton>
            </div>
          </>
        ) : (
          <IdleCard controls={controls} />
        )}
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
          open={controls.consent.open}
          title="Gửi âm thanh để nhận dạng"
          confirmLabel="Đồng ý và bắt đầu"
          cancelLabel="Huỷ"
          onCancel={controls.consent.cancel}
          onConfirm={controls.consent.confirm}
        >
          {CLOUD_CONSENT_TEXT}
        </ConfirmDialog>
        <ModelGateDialog
          open={controls.gate.open}
          languageName={controls.gate.languageName}
          view={controls.gate.view}
          onDownload={controls.gate.download}
          onCancelDownload={controls.gate.cancelDownload}
          onRestart={controls.gate.restart}
          onClose={controls.gate.close}
        />
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
              className="text-brand cursor-pointer bg-white hover:bg-white/90"
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
            className="bg-destructive/10 text-destructive mt-4 rounded-lg px-3 py-2 text-sm"
          >
            {error}
          </p>
        ) : null}
      </section>
      {metering ? <LatestCaptionCard caption={session.latestCaption} /> : null}
    </>
  );
}
