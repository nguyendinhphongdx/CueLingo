import { isLanguageCode, SUPPORTED_LANGUAGES } from '@cuelingo/shared';
import type { Debrief, SessionDetail, StoredSegment } from '@cuelingo/shared';
import { segmentSpeakerName } from './content';

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

function segmentLines(
  segment: StoredSegment,
  translates: boolean,
  session: SessionDetail,
): string[] {
  const head = `- **${formatSegmentTime(segment.startMs)} · ${segmentSpeakerName(segment, session.speakers)}**`;
  return translates
    ? [head, `  - EN: ${segment.textEn}`, `  - VI: ${segment.textVi || 'Chưa có bản dịch'}`]
    : [head, `  - ${segment.textEn}`];
}

export function buildDebriefMarkdown(
  debrief: Debrief,
  { session, includeTranscript = false }: DebriefMarkdownOptions = {},
): string {
  const language = session?.language;
  const known = isLanguageCode(language) ? SUPPORTED_LANGUAGES[language] : undefined;
  const translates = known?.translates ?? true;
  const learns = known?.learnable ?? true;
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
  ];

  if (learns) {
    lines.push(
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
    );
  }

  if (includeTranscript) {
    lines.push(
      translates ? '## Transcript song ngữ' : '## Transcript',
      '',
      ...(session?.segments.length
        ? [...session.segments]
            .sort((left, right) => left.startMs - right.startMs)
            .flatMap((segment) => segmentLines(segment, translates, session))
        : ['- Chưa có transcript']),
      '',
    );
  }

  return lines.join('\n');
}
