import type { Debrief, StoredSegment } from '@cuelingo/shared';

export type CopyableBlock = 'summary' | 'actionItems' | 'phraseSuggestions' | 'rephrase';
export type TranscriptFilter = 'all' | StoredSegment['source'];

export function filterTranscriptSegments(
  segments: StoredSegment[],
  filter: TranscriptFilter,
): StoredSegment[] {
  return segments.filter((segment) => filter === 'all' || segment.source === filter);
}

export function countTranscriptSpeakers(segments: StoredSegment[]) {
  return {
    all: segments.length,
    system: segments.filter((segment) => segment.source === 'system').length,
    mic: segments.filter((segment) => segment.source === 'mic').length,
  };
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
