import { create } from 'zustand';
import type { TranscriptEvent } from '../lib/native';

const MAX_SEGMENTS = 15;

export const VISIBLE_CAPTION_COUNT = 6;

export function updateTranscriptEvents(
  segments: TranscriptEvent[],
  incoming: TranscriptEvent,
): TranscriptEvent[] {
  const existingIndex = segments.findIndex((segment) => segment.segmentId === incoming.segmentId);
  const updated =
    existingIndex === -1
      ? [...segments, incoming]
      : segments.map((segment, index) => (index === existingIndex ? incoming : segment));

  return updated.slice(-MAX_SEGMENTS);
}

export function selectRecentSystemSentences(segments: TranscriptEvent[], limit = 15) {
  return segments
    .filter((segment) => segment.stream !== 'mic' && !segment.partial && segment.text.trim())
    .slice(-limit)
    .map((segment) => segment.text);
}

interface TranscriptState {
  segments: TranscriptEvent[];
  hasReceivedTranscript: boolean;
  push: (event: TranscriptEvent) => void;
  reset: () => void;
}

export const useTranscriptStore = create<TranscriptState>((set) => ({
  segments: [],
  hasReceivedTranscript: false,
  push: (event) =>
    set((state) => ({
      segments: updateTranscriptEvents(state.segments, event),
      hasReceivedTranscript: true,
    })),
  reset: () => set({ segments: [], hasReceivedTranscript: false }),
}));
