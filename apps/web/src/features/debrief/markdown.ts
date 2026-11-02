import type { Debrief, SessionDetail, StoredSegment } from '@cuelingo/shared';

export interface DebriefMarkdownOptions {
  session?: SessionDetail;
  includeTranscript?: boolean;
}

export function formatSegmentTime(startMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(startMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function segmentLines(segment: StoredSegment): string[] {
  return [
    `- **${formatSegmentTime(segment.startMs)} · ${segment.source === 'mic' ? 'Tôi' : 'Họ'}**`,
    `  - EN: ${segment.textEn}`,
    `  - VI: ${segment.textVi || 'Chưa có bản dịch'}`,
  ];
}

export function buildDebriefMarkdown(
  debrief: Debrief,
  { session, includeTranscript = false }: DebriefMarkdownOptions = {},
): string {
  const lines = [
    `# ${debrief.summary.headlineVi}`,
    '',
    '## Tóm tắt',
    '',
    ...debrief.summary.bulletsVi.map((bullet) => `- ${bullet}`),
    '',
    '## Quyết định & việc cần làm',
    '',
    ...(debrief.actionItems.length
      ? debrief.actionItems.map(
          (item) =>
            `- **${item.kind === 'decision' ? 'Quyết định' : 'Việc cần làm'}:** ${item.textVi}${item.owner ? ` — ${item.owner}` : ''}`,
        )
      : ['- Không có']),
    '',
    '## Cụm từ nên lưu',
    '',
    ...(debrief.phraseSuggestions.length
      ? debrief.phraseSuggestions.map(
          (item) =>
            `- **${item.phrase}** — ${item.meaningVi}${item.exampleEn ? `\n  - Ví dụ: ${item.exampleEn}` : ''}`,
        )
      : ['- Không có']),
    '',
    '## Câu bạn nói → câu nên nói',
    '',
    ...(debrief.rephrase.length
      ? debrief.rephrase.map(
          (item) =>
            `- ${item.said} → **${item.better}**${item.noteVi ? `\n  - ${item.noteVi}` : ''}`,
        )
      : ['- Không có']),
    '',
  ];

  if (includeTranscript) {
    lines.push(
      '## Transcript song ngữ',
      '',
      ...(session?.segments.length
        ? [...session.segments]
            .sort((left, right) => left.startMs - right.startMs)
            .flatMap(segmentLines)
        : ['- Chưa có transcript']),
      '',
    );
  }

  return lines.join('\n');
}
