import { serverConfig } from '../server';
import { native } from '../lib/native';
import { nativeErrorCode } from './session-errors';

export { nativeErrorCode };
import type { SelectableAssistLevel } from '../settings';

export const startSession = (assistLevel: SelectableAssistLevel) =>
  native.sessionStart({ assistLevel });
export const stopSession = () => native.sessionStop();
export const openDebrief = (sessionId: string) => {
  const webUrl = serverConfig().webUrl;
  return native.openUrl(`${webUrl}/sessions/${sessionId}`);
};

export function describeNativeError(error: unknown) {
  switch (nativeErrorCode(error)) {
    case 'session_already_running':
      return 'Một phiên đang chạy. Hãy dừng phiên đó trước khi bắt đầu phiên mới.';
    case 'invalid_assist_level':
      return 'Mức hỗ trợ không hợp lệ. Hãy chọn lại mức hỗ trợ.';
    case 'cloud_consent_required_switch':
      return 'Cần bạn đồng ý gửi âm thanh tới Google trước khi đổi sang ngôn ngữ này. Dừng họp, chọn ngôn ngữ đó và bấm Bắt đầu để xác nhận.';
    case 'cloud_consent_required':
      return 'Cần bạn đồng ý gửi âm thanh tới Google trước khi họp bằng ngôn ngữ này.';
    default:
      return error == null ? null : 'CueLingo gặp lỗi. Vui lòng thử lại.';
  }
}
