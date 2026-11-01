import { z } from 'zod';

export const DEBRIEF_PROMPT_VERSION = 'debrief.generate@v1';
export const DEBRIEF_TRANSCRIPT_MAX_CHARS = 12_000;

export const DebriefPromptInputSchema = z
  .object({
    segments: z
      .array(
        z
          .object({
            id: z.uuid(),
            source: z.enum(['mic', 'system']),
            textEn: z.string().trim().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type DebriefPromptInput = z.infer<typeof DebriefPromptInputSchema>;

const SYSTEM = [
  'Bạn phân tích ngắn gọn một cuộc họp tiếng Anh cho người học tiếng Anh là người Việt.',
  'Chỉ trả về một JSON object hợp lệ, không Markdown và không thêm trường.',
  'JSON gồm đúng 5 khối nội dung và một điểm hiểu:',
  '- summary: {headlineVi, bulletsVi}; tối đa 6 gạch đầu dòng tiếng Việt.',
  '- actionItems: tối đa 12 mục {textVi, owner?, kind}; kind chỉ là "decision" hoặc "todo".',
  '- hardSegmentIds: tối đa 10 id; chỉ chọn id xuất hiện trong transcript.',
  '- phraseSuggestions: tối đa 10 mục {phrase, meaningVi, exampleEn?}.',
  '- rephrase: tối đa 6 mục {said, better, noteVi?}; chỉ dùng câu có nhãn "Tôi", theo dạng câu bạn nói → câu nên nói.',
  '- comprehensionPct: số từ 0 đến 100, hoặc null nếu dữ liệu quá ít.',
  'Viết tiếng Việt ngắn gọn. Không bịa quyết định, việc cần làm, người phụ trách hoặc câu người dùng đã nói.',
].join('\n');

function transcriptLine(
  segment: DebriefPromptInput['segments'][number],
  maxChars = Number.POSITIVE_INFINITY,
): string {
  const speaker = segment.source === 'mic' ? 'Tôi' : 'Họ';
  const prefix = `[${segment.id}] ${speaker}: `;
  const textLimit = Math.max(0, maxChars - prefix.length);
  return prefix + segment.textEn.slice(-textLimit);
}

/** Keeps the most recent transcript lines, up to the prompt's bounded context. */
export function buildDebriefPrompt(input: DebriefPromptInput) {
  const { segments } = DebriefPromptInputSchema.parse(input);
  const kept: string[] = [];
  let length = 0;

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const line = transcriptLine(segments[index]!);
    const separatorLength = kept.length === 0 ? 0 : 1;
    if (length + separatorLength + line.length > DEBRIEF_TRANSCRIPT_MAX_CHARS) {
      if (kept.length === 0)
        kept.push(transcriptLine(segments[index]!, DEBRIEF_TRANSCRIPT_MAX_CHARS));
      break;
    }
    kept.push(line);
    length += separatorLength + line.length;
  }

  return { system: SYSTEM, prompt: `Transcript (cũ → mới):\n${kept.reverse().join('\n')}` };
}
