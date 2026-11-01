import { native } from '../lib/native';
import type { SelectableAssistLevel } from '../settings';

export const startSession = (assistLevel: SelectableAssistLevel) =>
  native.sessionStart({ assistLevel });
export const stopSession = () => native.sessionStop();
export const toggleOverlay = () => native.toggleOverlay();
export const openDebrief = (sessionId: string) => {
  const webUrl = (import.meta.env.VITE_WEB_URL || 'http://localhost:3000').replace(/\/$/, '');
  return native.openUrl(`${webUrl}/sessions/${sessionId}`);
};

function nativeErrorCode(error: unknown) {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'code' in error) return String(error.code);
  return '';
}

export function describeNativeError(error: unknown) {
  switch (nativeErrorCode(error)) {
    case 'session_already_running':
      return 'Một phiên đang chạy. Hãy dừng phiên đó trước khi bắt đầu phiên mới.';
    case 'invalid_assist_level':
      return 'Mức hỗ trợ không hợp lệ. Hãy chọn lại mức hỗ trợ.';
    default:
      return error == null ? null : 'CueLingo gặp lỗi. Vui lòng thử lại.';
  }
}
