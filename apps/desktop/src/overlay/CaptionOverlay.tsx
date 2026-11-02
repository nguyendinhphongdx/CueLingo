import { ArrowDown, EyeOff, ListChecks, MessageSquareQuote, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { native, type TranscriptEvent } from '../lib/native';
import { DRAWER_WIDTH, QuickAssistPanel, useQuickAssist } from '../quick-assist';
import { saveAssistLevel } from '../settings/use-assist-settings';
import type { SelectableAssistLevel } from '../settings/settings-store';
import { CaptionBlock } from './CaptionBlock';
import { DisplayMenu } from './DisplayMenu';
import { useOverlayPrefs, type OverlayTheme } from './overlay-prefs';
import { sampleTranscript } from './sample';
import { useTranscriptStore } from './transcript-store';
import { useLiveStatus, type LiveStatus } from './use-live-status';
import { useOverlayAssistLevel } from './use-overlay-settings';
import { useDrawerWindow } from './use-drawer-window';
import { useTranscript } from './use-transcript';

export { clampFontSize, readFontSize, storeFontSize } from './overlay-prefs';

interface CaptionOverlayProps {
  level?: number;
  segments?: TranscriptEvent[];
  receivedTranscript?: boolean;
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

const iconButton =
  'focus-visible:ring-ring text-muted-foreground hover:text-foreground hover:bg-foreground/10 flex size-9 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none';

function ActionButton({
  icon,
  label,
  hint,
  active = false,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  /** The panel for this action is open. */
  active?: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={`${label} (${hint})`}
      className={`focus-visible:ring-ring flex h-9 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
        active ? 'bg-primary text-primary-foreground' : 'bg-foreground/10 hover:bg-foreground/15'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function CaptionOverlay({
  level,
  segments,
  receivedTranscript,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  useTranscript(listen);

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

  // Opening something new always shows it expanded.
  useEffect(() => {
    if (panelView !== 'closed') setPanelCollapsed(false);
  }, [panelView]);

  // The docked panel changes how tall the captions are: stay on the newest line if the reader was there.
  useEffect(() => {
    if (followingRef.current) scrollToBottom();
  }, [panelView, panelCollapsed]);

  /** The footer buttons open their panel, and fold or unfold it when it is already the one showing. */
  function togglePanel(view: 'recap' | 'compose') {
    if (panelView === view) setPanelCollapsed((collapsed) => !collapsed);
    else if (view === 'recap') quickAssist.openRecap();
    else quickAssist.openCompose();
  }

  const drawerOpen = panelView !== 'closed' && !panelCollapsed;
  useDrawerWindow(drawerOpen, DRAWER_WIDTH);

  const hidden = assistLevel === 0;

  return (
    <section
      aria-label="Caption trực tiếp"
      data-theme={prefs.theme}
      className={`${prefs.theme} text-foreground relative flex h-screen flex-col overflow-hidden rounded-2xl border`}
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
        </span>
        <span className="flex-1" data-tauri-drag-region />
        <button
          type="button"
          aria-label="Tuỳ chỉnh hiển thị"
          aria-expanded={menuOpen}
          title="Tuỳ chỉnh hiển thị"
          onClick={() => setMenuOpen((open) => !open)}
          className={`${iconButton} ${menuOpen ? 'bg-foreground/10 text-foreground' : ''}`}
        >
          <SlidersHorizontal aria-hidden="true" className="size-[18px]" />
        </button>
        <button
          type="button"
          aria-label="Ẩn overlay"
          title="Ẩn overlay (⌘⇧L)"
          onClick={() => void native.toggleOverlay()}
          className={iconButton}
        >
          <EyeOff aria-hidden="true" className="size-[18px]" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="scroll-auto-hide min-h-0 min-w-0 flex-1 overflow-y-auto px-5 pb-4"
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
                  />
                );
              })}
            </div>
          )}
        </div>
        <QuickAssistPanel
          state={quickAssist.state}
          actions={quickAssist}
          collapsed={panelCollapsed}
          onToggleCollapsed={() => setPanelCollapsed((collapsed) => !collapsed)}
        />
      </div>

      <footer className="flex h-14 shrink-0 items-center gap-2 px-4">
        <ActionButton
          icon={<ListChecks aria-hidden="true" className="size-4" />}
          label="Tóm tắt"
          hint="⌘⇧W"
          active={panelView === 'recap' && !panelCollapsed}
          onClick={() => togglePanel('recap')}
        />
        <ActionButton
          icon={<MessageSquareQuote aria-hidden="true" className="size-4" />}
          label="Nói giúp"
          hint="⌘⇧S"
          active={panelView === 'compose' && !panelCollapsed}
          onClick={() => togglePanel('compose')}
        />
        <span className="flex-1" />
        {following ? null : (
          <button
            type="button"
            aria-label="Cuộn xuống caption mới nhất"
            onClick={resumeFollowing}
            className="focus-visible:ring-ring bg-primary text-primary-foreground flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
          >
            <ArrowDown aria-hidden="true" className="size-4" />
            Mới nhất
          </button>
        )}
      </footer>

      {menuOpen ? (
        <DisplayMenu
          level={assistLevel}
          onLevel={(next) => void saveAssistLevel(next as SelectableAssistLevel)}
          fontSize={prefs.fontSize}
          onFontSize={prefs.setFontSize}
          opacity={prefs.opacity}
          onOpacity={prefs.setOpacity}
          theme={prefs.theme}
          onTheme={prefs.setTheme}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}
    </section>
  );
}
