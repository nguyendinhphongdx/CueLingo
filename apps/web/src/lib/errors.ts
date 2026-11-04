import { ApiError } from '@cuelingo/core-sdk';
import { ErrorCode } from '@cuelingo/shared';

/** What the user reads for each API error code. Server messages are English and for developers, never shown. */
const MESSAGES: Record<string, string> = {
  [ErrorCode.Validation]: 'Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại',
  [ErrorCode.Unauthorized]: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
  [ErrorCode.Forbidden]: 'Bạn không có quyền thực hiện thao tác này',
  [ErrorCode.NotFound]: 'Không tìm thấy dữ liệu này',
  [ErrorCode.Conflict]: 'Mục này đã tồn tại',
  [ErrorCode.Internal]: 'Máy chủ gặp sự cố, vui lòng thử lại sau',
  NETWORK_ERROR: 'Không kết nối được tới máy chủ',
};

const FALLBACK = 'Đã có lỗi, vui lòng thử lại';

/** Vietnamese message for an error thrown by core-sdk, or null when there is no error. */
export function describeError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return MESSAGES[error.code] ?? FALLBACK;
  return FALLBACK;
}

/** Message for a failed follow-up draft: the codes this feature can hit first, then the general ones. */
export function describeFollowupError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === ErrorCode.RateLimited) return 'Bạn soạn hơi nhanh, đợi một lát rồi thử lại.';
    if (error.code === ErrorCode.FollowupFailed)
      return 'Chưa soạn được. Thử lại hoặc chọn giọng khác.';
    if (error.status === 404) return 'Debrief chưa sẵn sàng.';
  }
  return describeError(error) ?? FALLBACK;
}

/** Message for a failed "regenerate the debrief" request: not ended or empty (409), too fast (429), else generic. */
export function describeRegenerateError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'Cuộc họp chưa kết thúc hoặc không có nội dung.';
    if (error.status === 429) return 'Bạn bấm hơi nhanh, đợi một lát rồi thử lại.';
  }
  return 'Chưa tạo lại được debrief. Hãy thử lại sau.';
}

/** Message for a failed speaker rename: the person is gone (404), the name is rejected (400), else generic. */
export function describeRenameError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Không tìm thấy người nói này.';
    if (error.status === 400) return 'Tên chưa hợp lệ, dùng từ 1 đến 40 ký tự.';
  }
  return describeError(error) ?? FALLBACK;
}
