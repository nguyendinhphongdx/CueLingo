import { formatDateVn, quotaExceededMessage } from './usage';

/** Vietnamese wording and small rules of goal lessons (ADR 0025). Structural: this package does not import `shared`. */

/** The two voices of a dialogue: one per role, fixed, so the audio is the same for everyone and cached once. */
export type DialogueVoice = 'Kore' | 'Puck';
export const voiceForSpeaker = (speaker: string): DialogueVoice =>
  speaker === 'b' ? 'Puck' : 'Kore';

/** Shown under the typing box: the sentence leaves the device. */
export const PRACTICE_PRIVACY_NOTE =
  'Câu bạn gõ được gửi tới Google Gemini để góp ý và không được lưu lại. Đừng gõ thông tin mật của dự án.';
/** Shown when picking a goal and on every lesson. */
export const LESSON_AI_NOTE = 'Bài học do AI soạn, có thể sai; bấm Báo bài sai nếu thấy lỗi.';
export const LESSON_PREPARING_TEXT = 'Đang soạn bài… thường mất khoảng 15–25 giây lần đầu.';

export const LEVEL_NAMES: Record<string, string> = {
  a2: 'Sơ cấp (A2)',
  b1: 'Trung cấp (B1)',
  b2: 'Trung cao (B2)',
  c1: 'Cao cấp (C1)',
};
export const describeGoalLevel = (level: string) => LEVEL_NAMES[level] ?? level.toUpperCase();
export const GOAL_LEVEL_OPTIONS = ['a2', 'b1', 'b2', 'c1'] as const;

export const REPORT_REASONS = [
  { value: 'english', label: 'Tiếng Anh sai hoặc không tự nhiên' },
  { value: 'vietnamese', label: 'Tiếng Việt sai hoặc cứng' },
  { value: 'off_goal', label: 'Lạc khỏi mục tiêu' },
  { value: 'level', label: 'Không đúng trình độ' },
  { value: 'other', label: 'Lý do khác' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

export const REGISTER_LABELS: Record<string, string> = {
  formal: 'Trang trọng',
  neutral: 'Trung tính',
  casual: 'Thân mật',
};
export const VERDICT_LABELS: Record<string, string> = {
  ok: 'Đúng và tự nhiên',
  minor: 'Gần đúng, có thể tốt hơn',
  wrong: 'Cần sửa',
};

export const LESSON_STATUS_LABELS: Record<string, string> = {
  todo: 'Chưa học',
  learning: 'Đang học',
  done: 'Đã xong',
};

/** "Hạn 01/12/2026" or "" when the goal has no deadline. `deadline` is `YYYY-MM-DD`. */
export function deadlineLabel(deadline: string | null | undefined): string {
  if (!deadline) return '';
  const text = formatDateVn(`${deadline}T00:00:00+07:00`);
  return text ? `Hạn ${text}` : '';
}

/** Whole days from `today` (`YYYY-MM-DD`) to `deadline`; negative once it has passed, null without a deadline. */
export function daysLeft(deadline: string | null | undefined, today: string): number | null {
  if (!deadline) return null;
  const diff = Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Number.isNaN(diff) ? null : Math.round(diff / 86_400_000);
}

/** A stable shuffle of `0..count-1`: a retake shows the options in another order, the answer stays by index. */
export function shuffledOrder(count: number, seed: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  let state = (seed * 2_654_435_761) >>> 0 || 1;
  for (let i = count - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const j = state % (i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

export interface LessonErrorLike {
  status?: number;
  code?: string;
  details?: unknown;
}

/**
 * What to tell the person when a lesson call fails. Opened lessons and the review queue keep working,
 * and a failure is never counted against the allowance (AC9).
 */
export function lessonErrorMessage(
  error: LessonErrorLike | null | undefined,
  action: 'open' | 'practice' | 'quiz' | 'report' | 'goal' | 'list' = 'open',
): string {
  const code = error?.code;
  if (code === 'QUOTA_EXCEEDED') {
    const details = (error?.details ?? {}) as { metric?: string; resetsAt?: string };
    return quotaExceededMessage(details.metric ?? '', details.resetsAt);
  }
  if (code === 'LESSONS_DISABLED') {
    return 'Tính năng bài học theo mục tiêu chưa mở. Các bài đã mở và phần ôn tập vẫn dùng bình thường.';
  }
  if (code === 'RATE_LIMITED' && action === 'open') {
    return 'Bạn mở bài mới hơi nhiều trong một phút. Đợi một chút rồi thử lại; không bị tính vào hạn mức.';
  }
  if (code === 'RATE_LIMITED') return 'Bạn gửi hơi nhanh, đợi một chút rồi thử lại.';
  if (code === 'NETWORK_ERROR') return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  if (code === 'CONFLICT' && action === 'goal') {
    return 'Bạn đã có mục tiêu này, hoặc đã đủ 3 mục tiêu. Xoá bớt một mục tiêu để thêm.';
  }
  if (code === 'LESSON_FAILED') {
    if (action === 'practice')
      return 'Chưa góp ý được câu này. Câu của bạn không bị tính vào hạn mức, thử lại sau.';
    return 'Bài mới chưa soạn được. Các bài đã mở và phần ôn tập vẫn dùng bình thường; không bị tính vào hạn mức, thử lại sau ít phút.';
  }
  if (code === 'NOT_FOUND') return 'Không tìm thấy mục tiêu hoặc bài học này.';
  const fallback: Record<typeof action, string> = {
    open: 'Chưa mở được bài học. Thử lại sau.',
    practice: 'Chưa góp ý được câu này. Thử lại sau.',
    quiz: 'Chưa nộp được bài kiểm tra. Thử lại sau.',
    report: 'Chưa gửi được báo cáo. Thử lại sau.',
    goal: 'Chưa lưu được mục tiêu. Thử lại sau.',
    list: 'Chưa tải được mục tiêu. Các khoá từ cuộc họp vẫn dùng bình thường.',
  };
  return fallback[action];
}
