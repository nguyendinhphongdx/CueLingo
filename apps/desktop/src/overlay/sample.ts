import type { TranscriptEvent } from '../lib/native';

export const sampleTranscript: TranscriptEvent[] = [
  {
    segmentId: 'sample-1',
    text: "Let's review the plan for this week.",
    translation: 'Hãy cùng xem lại kế hoạch cho tuần này.',
    partial: false,
  },
  {
    segmentId: 'sample-2',
    text: 'The first milestone is ready.',
    translation: 'Cột mốc đầu tiên đã sẵn sàng.',
    partial: false,
  },
  {
    segmentId: 'sample-3',
    text: 'Next, we should discuss…',
    translation: 'Tiếp theo, chúng ta nên thảo luận…',
    partial: true,
  },
];
