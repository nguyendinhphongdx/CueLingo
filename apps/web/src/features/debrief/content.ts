import type { Debrief, SessionDetail, Speaker, StoredSegment } from '@cuelingo/shared';
import { speakerDisplayName } from '@cuelingo/ui/lib/speaker';

export type CopyableBlock = 'summary' | 'actionItems' | 'phraseSuggestions' | 'rephrase';
/** `all`, `me`, `other` (not told apart), or the id of a speaker of the meeting. */
export type TranscriptFilter = string;

export interface SegmentSpeaker {
  /** Filter key: `me`, `other`, or the speaker id. */
  key: string;
  label: string | null;
  displayName: string | null;
  source: StoredSegment['source'];
  /** The speaker row this sentence belongs to; null for older sentences told apart by `source` only. */
  speaker: Speaker | null;
}

/** Who said a sentence: its speaker row, else `Tôi` for the mic and `Người khác` for the rest. */
export function segmentSpeaker(segment: StoredSegment, speakers: Speaker[]): SegmentSpeaker {
  const speaker = segment.speakerId
    ? (speakers.find((item) => item.id === segment.speakerId) ?? null)
    : null;
  const label = speaker?.label ?? null;
  const base = { label, displayName: speaker?.displayName ?? null, source: segment.source };
  if (label === 'me' || (!speaker && segment.source === 'mic'))
    return { ...base, key: 'me', speaker };
  return speaker ? { ...base, key: speaker.id, speaker } : { ...base, key: 'other', speaker: null };
}

/** The name printed for a sentence's speaker (also used by the markdown export). */
export function segmentSpeakerName(segment: StoredSegment, speakers: Speaker[]): string {
  return speakerDisplayName(segmentSpeaker(segment, speakers));
}

export function filterTranscriptSegments(
  segments: StoredSegment[],
  filter: TranscriptFilter,
  speakers: Speaker[] = [],
): StoredSegment[] {
  return segments.filter(
    (segment) => filter === 'all' || segmentSpeaker(segment, speakers).key === filter,
  );
}

/** Sentence count per filter key: `all`, `me`, `other` and each speaker id. */
export function countTranscriptSpeakers(
  segments: StoredSegment[],
  speakers: Speaker[] = [],
): Record<string, number> {
  const counts: Record<string, number> = { all: segments.length, me: 0, other: 0 };
  for (const speaker of speakers) counts[speaker.id] = 0;
  for (const segment of segments) {
    const { key } = segmentSpeaker(segment, speakers);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export interface TranscriptFilterOption {
  value: TranscriptFilter;
  label: string;
}

/** Tất cả / Tôi / each person of the meeting / Người khác, each with its sentence count. */
export function transcriptFilterOptions(session: SessionDetail): TranscriptFilterOption[] {
  const counts = countTranscriptSpeakers(session.segments, session.speakers);
  const people = [...session.speakers]
    .filter((speaker) => speaker.label !== 'me')
    .sort((left, right) => left.label.localeCompare(right.label));
  const options: TranscriptFilterOption[] = [
    { value: 'all', label: `Tất cả ${counts.all}` },
    { value: 'me', label: `Tôi ${counts.me}` },
    ...people.map((speaker) => ({
      value: speaker.id,
      label: `${speakerDisplayName({ ...speaker, source: 'system' })} ${counts[speaker.id]}`,
    })),
  ];
  // Older meetings, and sentences nobody could place, only have "Người khác".
  if (counts.other || !people.length)
    options.push({ value: 'other', label: `Người khác ${counts.other}` });
  return options;
}

export function buildBlockCopyText(debrief: Debrief, block: CopyableBlock): string {
  switch (block) {
    case 'summary':
      return [
        debrief.summary.headlineVi,
        ...debrief.summary.bulletsVi.map((item) => `- ${item}`),
      ].join('\n');
    case 'actionItems':
      return debrief.actionItems.length
        ? debrief.actionItems
            .map(
              (item) =>
                `${item.kind === 'decision' ? 'Quyết định' : 'Việc cần làm'}: ${item.textVi}${item.owner ? ` — ${item.owner}` : ''}`,
            )
            .join('\n')
        : 'Không có mục nào.';
    case 'phraseSuggestions':
      return debrief.phraseSuggestions.length
        ? debrief.phraseSuggestions
            .map(
              (item) =>
                `${item.phrase} — ${item.meaningVi}${item.exampleEn ? `\nVí dụ: ${item.exampleEn}` : ''}`,
            )
            .join('\n\n')
        : 'Không có cụm từ gợi ý.';
    case 'rephrase':
      return debrief.rephrase.length
        ? debrief.rephrase
            .map((item) => `${item.said} → ${item.better}${item.noteVi ? `\n${item.noteVi}` : ''}`)
            .join('\n\n')
        : 'Không có câu gợi ý.';
  }
}
