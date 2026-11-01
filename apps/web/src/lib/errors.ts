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
