import {
  ArrowDown,
  Bot,
  ChevronDown,
  EyeOff,
  ListChecks,
  Mic,
  MicOff,
  MessageSquareQuote,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '@cuelingo/ui/components/icon-button';
import { native, type NoticeEvent, type TranscriptEvent } from '../lib/native';
import { shortcutLabel } from '../lib/platform';
import { useMicMuted } from '../session/use-mic-muted';
import {
  DRAWER_WIDTH,
  MeetingAskPanel,
  QuickAssistPanel,
  useMeetingAsk,
  useQuickAssist,
} from '../quick-assist';
import { saveAssistLevel } from '../settings/use-assist-settings';
import type { SelectableAssistLevel } from '../settings/settings-store';
import { queueSettingsPatch } from '../settings/settings-api';
import { CaptionBlock } from './CaptionBlock';
import { NoticeBar, type NoticeAction } from './NoticeBar';
import { noticeActionFor } from './notice-actions';
import { useNotices } from './use-notices';
import { DisplayMenu } from './DisplayMenu';
import { ToolsMenu, type ToolItem } from './ToolsMenu';
import { useOverlayPrefs, type OverlayTheme } from './overlay-prefs';
import { sampleTranscript } from './sample';
import { selectRecentSystemSentences, useTranscriptStore } from './transcript-store';
import { useLiveStatus, type LiveStatus } from './use-live-status';
import { useOverlayAssistLevel } from './use-overlay-settings';
import { useDrawerWindow } from './use-drawer-window';
import { useTranscript } from './use-transcript';

export { clampFontSize, readFontSize, storeFontSize } from './overlay-prefs';

interface CaptionOverlayProps {
  level?: number;
  segments?: TranscriptEvent[];
  receivedTranscript?: boolean;
  /** Allowance messages; the overlay listens for them itself unless given (tests). */
  notices?: NoticeEvent[];
  /** The fixing action of a notice, if it has one. */
  noticeAction?: (notice: NoticeEvent) => NoticeAction | undefined;
  /** Microphone state; the overlay listens for it itself unless given (tests). */
  micMuted?: boolean;
  micFailed?: boolean;
  listen?: boolean;
  initialFontSize?: number;
  initialTheme?: OverlayTheme;
}

/** Within this distance of the bottom the overlay keeps following new captions. */
const FOLLOW_MARGIN_PX = 48;
/** The newest sentences stay at full strength; older ones recede. */
const FRESH_COUNT = 2;

const statusText: Record<LiveStatus, string> = {
  waiting: 'Đang chờ giọng nói',
  listening: 'Đang nghe',
  quiet: 'Đang im lặng',
};

export function CaptionOverlay({
  level,
  segments,
  receivedTranscript,
  notices,
  noticeAction,
  micMuted,
  micFailed,
  listen = true,
  initialFontSize,
  initialTheme,
}: CaptionOverlayProps) {
  const storedSegments = useTranscriptStore((state) => state.segments);
  const storedReceived = useTranscriptStore((state) => state.hasReceivedTranscript);
  const syncedLevel = useOverlayAssistLevel(4, listen);
  const assistLevel = level ?? syncedLevel;
  const prefs = useOverlayPrefs({ fontSize: initialFontSize, theme: initialTheme });
  const quickAssist = useQuickAssist({ listen });
  const meetingAsk = useMeetingAsk({ listen });
  const mic = useMicMuted(listen);
  const muted = micMuted ?? mic.muted;
  const micUnavailable = micFailed ?? mic.failed;
  const [menu, setMenu] = useState<'tools' | 'display' | null>(null);
  const closeMenu = () => setMenu(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  useTranscript(listen);
  const noticeState = useNotices(listen);
  const shownNotices = notices ?? noticeState.notices;

  const received = receivedTranscript ?? storedReceived;
  const preview = !received;
  const captionSegments = received ? (segments ?? storedSegments) : sampleTranscript;
  const status = useLiveStatus(captionSegments, received);

  const scrollRef = useRef<HTMLDivElement>(null);
  const followingRef = useRef(true);
  const [following, setFollowing] = useState(true);

  function scrollToBottom() {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }

  /** Follow new captions only while the reader sits near the bottom; scrolling up pauses it. */
  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;
    const near =
      element.scrollHeight - element.scrollTop - element.clientHeight <= FOLLOW_MARGIN_PX;
    followingRef.current = near;
    setFollowing(near);
  }

  function resumeFollowing() {
    followingRef.current = true;
    setFollowing(true);
    scrollToBottom();
  }

  useEffect(() => {
    if (followingRef.current) scrollToBottom();
  }, [captionSegments, prefs.fontSize, assistLevel]);

  const panelView = quickAssist.state.view;
  const askOpen = meetingAsk.state.open;
  // Two things share the drawer; the one opened last is in front, the other keeps what it holds.
  const [front, setFront] = useState<'ask' | 'tool'>('tool');

  // Opening something new always shows it expanded.
  useEffect(() => {
    if (quickAssist.openCount === 0) return;
    setFront('tool');
    setPanelCollapsed(false);
  }, [quickAssist.openCount]);
  useEffect(() => {
    if (meetingAsk.openCount === 0) return;
    setFront('ask');
    setPanelCollapsed(false);
  }, [meetingAsk.openCount]);

  const activePanel =
    askOpen && (front === 'ask' || panelView === 'closed')
      ? 'ask'
      : panelView !== 'closed'
        ? 'tool'
        : null;

  // The docked panel changes how tall the captions are: stay on the newest line if the reader was there.
  useEffect(() => {
    if (followingRef.current) scrollToBottom();
  }, [activePanel, panelView, panelCollapsed]);

  /** The footer buttons open their panel, and fold or unfold it when it is already the one showing. */
  function togglePanel(view: 'recap' | 'compose') {
    if (panelView === view && activePanel === 'tool') setPanelCollapsed((collapsed) => !collapsed);
    else if (view === 'recap') quickAssist.openRecap();
    else quickAssist.openCompose();
  }

  const drawerOpen = activePanel !== null && !panelCollapsed;
  const askAvailable = meetingAsk.state.availability === 'available';

  /** Every tool of the overlay. A new one is one more entry here. */
  const tools: ToolItem[] = [
    {
      id: 'recap',
      label: 'Tóm tắt',
      description: 'Họ vừa nói gì, trong 1 phút qua',
      hint: shortcutLabel('W'),
      icon: <ListChecks aria-hidden="true" className="size-[18px]" />,
      active: activePanel === 'tool' && panelView === 'recap' && !panelCollapsed,
      onSelect: () => togglePanel('recap'),
    },
    {
      id: 'compose',
      label: 'Nói giúp',
      description: 'Soạn câu tiếng Anh từ ý của bạn',
      hint: shortcutLabel('S'),
      icon: <MessageSquareQuote aria-hidden="true" className="size-[18px]" />,
      active: activePanel === 'tool' && panelView === 'compose' && !panelCollapsed,
      onSelect: () => togglePanel('compose'),
    },
    // Only when the server offers it: an older or switched-off server shows no entry at all.
    ...(askAvailable
      ? [
          {
            id: 'ask',
            label: 'Hỏi trợ lý',
            description: 'Giải thích, nhắc lại cuộc họp trước',
            hint: shortcutLabel('Y'),
            icon: <Bot aria-hidden="true" className="size-[18px]" />,
            active: activePanel === 'ask' && !panelCollapsed,
            onSelect: () => {
              if (activePanel === 'ask') setPanelCollapsed((collapsed) => !collapsed);
              else meetingAsk.open();
            },
          },
        ]
      : []),
  ];
  const drawerWidth = useDrawerWindow(drawerOpen, DRAWER_WIDTH);
  // While the drawer slides shut its content stays what it was, instead of vanishing on the first frame.
  const [shownPanel, setShownPanel] = useState(quickAssist.state);
  const [shownKind, setShownKind] = useState<'ask' | 'tool'>('tool');
  useEffect(() => {
    if (!drawerOpen || !activePanel) return;
    setShownKind(activePanel);
    setShownPanel(quickAssist.state);
  }, [drawerOpen, activePanel, quickAssist.state]);

  const hidden = assistLevel === 0;
  // What the other side said last, for the Nói giúp drawer. Kept in memory only.
  const asked = received
    ? (selectRecentSystemSentences(segments ?? storedSegments, 1)[0] ?? null)
    : null;

  return (
    <section
      aria-label="Caption trực tiếp"
      data-theme={prefs.theme}
      className={`${prefs.theme} text-caption-text relative flex h-screen flex-col overflow-hidden rounded-2xl border`}
      style={{
        backgroundColor: `color-mix(in oklab, var(--background) ${prefs.opacity}%, transparent)`,
      }}
    >
      <header
        data-tauri-drag-region
        aria-label="Kéo để di chuyển"
        className="flex h-12 shrink-0 cursor-grab items-center gap-3 px-4 active:cursor-grabbing"
      >
        <span
          data-tauri-drag-region
          className="pointer-events-none flex min-w-0 items-center gap-2 text-sm font-medium"
        >
          <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
            {status === 'listening' ? (
              <span className="bg-primary/60 absolute inline-flex size-full animate-ping rounded-full" />
            ) : null}
            <span
              className={`relative inline-flex size-2.5 rounded-full ${
                status === 'listening' ? 'bg-primary' : 'bg-muted-foreground/50'
              }`}
            />
          </span>
          <span className="truncate" aria-live="polite">
            {preview ? 'Xem trước' : statusText[status]}
          </span>
          {muted ? (
            <span
              role="status"
              className="text-warning bg-warning/15 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold"
            >
              <MicOff aria-hidden="true" className="size-3.5" />
              Micro đã tắt
            </span>
          ) : null}
        </span>
        <span className="flex-1" data-tauri-drag-region />
        <IconButton
          label="Công cụ hỗ trợ"
          aria-haspopup="menu"
          aria-expanded={menu === 'tools'}
          active={menu === 'tools' || drawerOpen}
          className="w-auto gap-0.5 px-2"
          icon={
            <>
              <Sparkles aria-hidden="true" className="size-[18px]" />
              <ChevronDown aria-hidden="true" className="size-3.5" />
            </>
          }
          onClick={() => {
            // The server may have turned the assistant on or off since the overlay opened.
            meetingAsk.refresh();
            setMenu((open) => (open === 'tools' ? null : 'tools'));
          }}
        />
        <span aria-hidden="true" className="bg-border mx-0.5 h-5 w-px" />
        <IconButton
          label="Tuỳ chỉnh hiển thị"
          aria-expanded={menu === 'display'}
          active={menu === 'display'}
          icon={<SlidersHorizontal aria-hidden="true" className="size-[18px]" />}
          onClick={() => setMenu((open) => (open === 'display' ? null : 'display'))}
        />
        <IconButton
          label={muted ? 'Bật micro' : 'Tắt micro'}
          aria-pressed={muted}
          // Nothing to switch when the microphone never opened; but after a failed reopen it can be tried again.
          disabled={micUnavailable && !muted}
          active={muted}
          icon={
            muted ? (
              <MicOff aria-hidden="true" className="size-[18px]" />
            ) : (
              <Mic aria-hidden="true" className="size-[18px]" />
            )
          }
          // Without a running meeting there is nothing to switch; the click is simply ignored.
          onClick={() => void mic.setMuted(!muted).catch(() => undefined)}
        />
        <IconButton
          label="Ẩn overlay"
          title={`Ẩn overlay (${shortcutLabel('L')})`}
          icon={<EyeOff aria-hidden="true" className="size-[18px]" />}
          onClick={() => void native.toggleOverlay()}
        />
      </header>

      <NoticeBar
        notices={shownNotices}
        onDismiss={noticeState.dismiss}
        actionFor={noticeAction ?? noticeActionFor}
      />

      <div className="flex min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 pb-5"
          style={{ fontSize: prefs.fontSize }}
        >
          {hidden ? (
            <p className="text-muted-foreground pt-6 text-center text-sm">
              Caption đang ẩn. Mở “Tuỳ chỉnh hiển thị” để bật lại.
            </p>
          ) : captionSegments.length === 0 ? (
            <p className="text-muted-foreground pt-6 text-center text-sm">Đang chờ giọng nói…</p>
          ) : (
            <div className="flex flex-col gap-4">
              {captionSegments.map((segment, index) => {
                const previous = captionSegments[index - 1];
                return (
                  <CaptionBlock
                    key={segment.segmentId}
                    segment={segment}
                    level={assistLevel}
                    faded={index < captionSegments.length - FRESH_COUNT}
                    showSpeaker={!previous || previous.stream !== segment.stream}
                    onLookup={(term) => quickAssist.lookup(term, segment.text)}
                    onExplain={
                      askAvailable && received && meetingAsk.sessionId
                        ? () =>
                            meetingAsk.ask('Giải thích câu này', {
                              segmentId: segment.segmentId,
                              text: segment.text,
                            })
                        : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
        {drawerWidth > 0.5 ? (
          <div className="flex shrink-0 justify-end overflow-hidden" style={{ width: drawerWidth }}>
            {shownKind === 'ask' ? (
              <MeetingAskPanel ask={meetingAsk} onToggleCollapsed={() => setPanelCollapsed(true)} />
            ) : (
              <QuickAssistPanel
                state={shownPanel}
                asked={asked}
                actions={quickAssist}
                onToggleCollapsed={() => setPanelCollapsed(true)}
              />
            )}
          </div>
        ) : null}
      </div>

      {following ? null : (
        <button
          type="button"
          aria-label="Cuộn xuống caption mới nhất"
          onClick={resumeFollowing}
          className="focus-visible:ring-ring bg-primary text-primary-foreground absolute bottom-4 left-1/2 flex h-9 -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium shadow-lg focus-visible:ring-2 focus-visible:outline-none"
        >
          <ArrowDown aria-hidden="true" className="size-4" />
          Mới nhất
        </button>
      )}

      {menu === 'tools' ? <ToolsMenu items={tools} onClose={closeMenu} /> : null}

      {menu === 'display' ? (
        <DisplayMenu
          level={assistLevel}
          onLevel={(next) => void saveAssistLevel(next as SelectableAssistLevel)}
          fontSize={prefs.fontSize}
          onFontSize={(fontSize) => {
            prefs.setFontSize(fontSize);
            queueSettingsPatch({ overlay: { fontSize } });
          }}
          opacity={prefs.opacity}
          onOpacity={(opacity) => {
            prefs.setOpacity(opacity);
            queueSettingsPatch({ overlay: { opacity } });
          }}
          theme={prefs.theme}
          onTheme={(theme) => {
            prefs.setTheme(theme);
            queueSettingsPatch({ overlay: { theme } });
          }}
          onClose={closeMenu}
        />
      ) : null}
    </section>
  );
}
