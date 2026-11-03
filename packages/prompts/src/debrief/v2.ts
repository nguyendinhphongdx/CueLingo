import { buildDebriefPrompt, type DebriefPromptInput } from './v1';

/**
 * Debrief for a meeting held in Vietnamese (ADR 0014). The transcript is already Vietnamese and the
 * learning blocks do not apply, so v1 ("analyse an X meeting for a Vietnamese learner of X") cannot serve it.
 */
export const DEBRIEF_V2_PROMPT_VERSION = 'debrief.generate@v2';

const SYSTEM = [
  'Bạn tóm tắt ngắn gọn một cuộc họp tiếng Việt. Transcript là văn bản nhận dạng tự động nên có thể sai chính tả hoặc thiếu dấu; hiểu theo ngữ cảnh, đừng chép lại lỗi.',
  'Chỉ trả về một JSON object hợp lệ, không Markdown và không thêm trường.',
  'JSON gồm đúng các trường sau:',
  '- summary: {headlineVi, bulletsVi}; tối đa 6 gạch đầu dòng, viết bằng tiếng Việt.',
  '- actionItems: tối đa 12 mục {textVi, owner?, kind}; kind chỉ là "decision" (quyết định đã chốt) hoặc "todo" (việc cần làm); textVi viết bằng tiếng Việt.',
  '- hardSegmentIds: luôn là [].',
  '- phraseSuggestions: luôn là [].',
  '- rephrase: luôn là [].',
  '- comprehensionPct: luôn là null.',
  'Nhãn "Tôi" là người dùng, "Họ" là những người còn lại; chỉ ghi owner khi transcript nói rõ ai phụ trách.',
  'Không bịa quyết định, việc cần làm hoặc người phụ trách. Nếu không có thì để mảng rỗng.',
].join('\n');

/** Same transcript framing as v1 so the context limit and speaker labels stay identical. */
export function buildDebriefPromptV2(input: DebriefPromptInput) {
  const { prompt } = buildDebriefPrompt(input);
  return { system: SYSTEM, prompt };
}
