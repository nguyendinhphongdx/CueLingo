import { CaptionLine } from '@cuelingo/ui/components/caption-line';
import type { TranscriptEvent } from '../lib/native';
import { sampleTranscript } from './sample';
import { useTranscriptStore } from './transcript-store';
import { useTranscript } from './use-transcript';

interface CaptionOverlayProps {
  level?: number;
  segments?: TranscriptEvent[];
  receivedTranscript?: boolean;
  listen?: boolean;
}

export function CaptionOverlay({
  level = 4,
  segments,
  receivedTranscript,
  listen = true,
}: CaptionOverlayProps) {
  const storedSegments = useTranscriptStore((state) => state.segments);
  const storedReceived = useTranscriptStore((state) => state.hasReceivedTranscript);
  useTranscript(listen);
  const visibleSegments =
    (receivedTranscript ?? storedReceived) ? (segments ?? storedSegments) : sampleTranscript;

  return (
    <section
      aria-label="Caption trực tiếp"
      className="overflow-hidden rounded-xl bg-black/60 text-white shadow-lg"
    >
      <div data-tauri-drag-region className="h-3 cursor-move" aria-hidden="true" />
      <div className="space-y-3 px-5 pb-5">
        {level === 0
          ? null
          : visibleSegments.map((segment) => (
              <CaptionLine
                key={segment.segmentId}
                text={level === 1 ? (segment.translation ?? 'Đang dịch…') : segment.text}
                translation={level === 1 ? undefined : (segment.translation ?? undefined)}
                partial={segment.partial}
                className="text-white [&>p+ p]:text-white/80"
              />
            ))}
      </div>
    </section>
  );
}
