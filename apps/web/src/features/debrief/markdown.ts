import type { Debrief } from '@cuelingo/shared';

export function buildDebriefMarkdown(debrief: Debrief): string {
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

  return lines.join('\n');
}
