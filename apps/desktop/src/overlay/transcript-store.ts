import { create } from 'zustand';
import type { TranscriptEvent } from '../lib/native';

const MAX_SEGMENTS = 6;

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
