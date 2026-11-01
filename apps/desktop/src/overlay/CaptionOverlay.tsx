import { CaptionLine } from '@cuelingo/ui/components/caption-line';
import { useState } from 'react';
import type { TranscriptEvent } from '../lib/native';
import { sampleTranscript } from './sample';
import { useTranscriptStore } from './transcript-store';
import { useOverlayAssistLevel } from './use-overlay-settings';
import { useTranscript } from './use-transcript';

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 24;
const DEFAULT_FONT_SIZE = 18;
const FONT_SIZE_KEY = 'cuelingo.overlay.fontSize';

interface CaptionOverlayProps {
  level?: number;
  segments?: TranscriptEvent[];
  receivedTranscript?: boolean;
  listen?: boolean;
  initialFontSize?: number;
  initialTheme?: 'light' | 'dark';
}

export function clampFontSize(value: number) {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value));
}

export function readFontSize() {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_FONT_SIZE;
    const stored = Number(localStorage.getItem(FONT_SIZE_KEY));
    return Number.isFinite(stored) && stored > 0 ? clampFontSize(stored) : DEFAULT_FONT_SIZE;
  } catch {
    return DEFAULT_FONT_SIZE;
  }
}

export function storeFontSize(value: number) {
  try {
    localStorage.setItem(FONT_SIZE_KEY, String(value));
  } catch {
    // The overlay remains usable when storage is blocked or full.
  }
}

export function CaptionOverlay({
  level,
  segments,
  receivedTranscript,
  listen = true,
  initialFontSize,
  initialTheme = 'dark',
}: CaptionOverlayProps) {
  const storedSegments = useTranscriptStore((state) => state.segments);
  const storedReceived = useTranscriptStore((state) => state.hasReceivedTranscript);
  const syncedLevel = useOverlayAssistLevel(4, listen);
  const assistLevel = level ?? syncedLevel;
  const [fontSize, setFontSize] = useState(() => clampFontSize(initialFontSize ?? readFontSize()));
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);
  useTranscript(listen);
  const visibleSegments =
    (receivedTranscript ?? storedReceived) ? (segments ?? storedSegments) : sampleTranscript;

  function resizeCaption(delta: number) {
    const next = clampFontSize(fontSize + delta);
    setFontSize(next);
    storeFontSize(next);
  }

  return (
    <section
      aria-label="Caption trực tiếp"
      data-theme={theme}
      className={
        theme === 'dark'
          ? 'overflow-hidden rounded-xl bg-black/70 text-white shadow-lg'
          : 'overflow-hidden rounded-xl bg-white/90 text-slate-950 shadow-lg'
      }
    >
      <div
        data-tauri-drag-region
        className="flex h-5 cursor-move items-center justify-center"
        aria-label="Kéo cửa sổ caption"
      >
        <span className="h-1 w-10 rounded-full bg-current opacity-30" aria-hidden="true" />
      </div>
      <div className="flex items-center justify-end gap-1 px-3 pb-2">
        <button
          type="button"
          aria-label="Giảm cỡ chữ"
          className="focus-visible:ring-ring min-h-11 min-w-11 cursor-pointer rounded px-2 py-1 font-semibold hover:bg-current/10 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default disabled:opacity-40"
          disabled={fontSize <= MIN_FONT_SIZE}
          onClick={() => resizeCaption(-2)}
        >
          A−
        </button>
        <span className="min-w-10 text-center text-xs" aria-label={`Cỡ chữ ${fontSize} px`}>
          {fontSize}px
        </span>
        <button
          type="button"
          aria-label="Tăng cỡ chữ"
          className="focus-visible:ring-ring min-h-11 min-w-11 cursor-pointer rounded px-2 py-1 font-semibold hover:bg-current/10 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default disabled:opacity-40"
          disabled={fontSize >= MAX_FONT_SIZE}
          onClick={() => resizeCaption(2)}
        >
          A+
        </button>
        <button
          type="button"
          aria-label={theme === 'dark' ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'}
          className="focus-visible:ring-ring ml-1 min-h-11 cursor-pointer rounded px-3 py-1 text-sm hover:bg-current/10 focus-visible:ring-2 focus-visible:outline-none"
          onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        >
          {theme === 'dark' ? 'Sáng' : 'Tối'}
        </button>
      </div>
      <div className="space-y-3 px-5 pb-5" style={{ fontSize }}>
        {assistLevel === 0
          ? null
          : visibleSegments.map((segment) => (
              <CaptionLine
                key={segment.segmentId}
                text={assistLevel === 1 ? (segment.translation ?? 'Đang dịch…') : segment.text}
                translation={assistLevel === 1 ? undefined : (segment.translation ?? undefined)}
                partial={segment.partial}
                className={`[&>p]:text-[inherit] ${
                  segment.partial ? 'font-normal opacity-60' : 'font-semibold'
                } ${
                  assistLevel === 3
                    ? '[&>p:first-child]:opacity-70 [&>p+p]:text-[inherit] [&>p+p]:font-bold'
                    : '[&>p+p]:text-[inherit] [&>p+p]:opacity-80'
                }`}
              />
            ))}
      </div>
    </section>
  );
}
