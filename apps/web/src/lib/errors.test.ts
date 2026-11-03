import { ApiError } from '@cuelingo/core-sdk';
import { describe, expect, it } from 'vitest';
import { describeError, describeFollowupError, describeRegenerateError } from './errors';

describe('describeError', () => {
  it('returns null when there is no error', () => {
    expect(describeError(null)).toBeNull();
    expect(describeError(undefined)).toBeNull();
  });

  it('maps API error codes to Vietnamese and never shows the server message', () => {
    const conflict = new ApiError(409, 'CONFLICT', 'Term "x" already exists');
    expect(describeError(conflict)).toBe('Mục này đã tồn tại');
    expect(describeError(new ApiError(0, 'NETWORK_ERROR', 'fetch failed'))).toBe(
      'Không kết nối được tới máy chủ',
    );
  });

  it('falls back to a generic message for anything else', () => {
    expect(describeError(new Error('boom'))).toBe('Đã có lỗi, vui lòng thử lại');
  });
});

describe('describeFollowupError', () => {
  it('tells rate limiting, a failed draft and a missing debrief apart', () => {
    expect(describeFollowupError(new ApiError(429, 'RATE_LIMITED', 'x'))).toBe(
      'Bạn soạn hơi nhanh, đợi một lát rồi thử lại.',
    );
    expect(describeFollowupError(new ApiError(502, 'FOLLOWUP_FAILED', 'x'))).toBe(
      'Chưa soạn được. Thử lại hoặc chọn giọng khác.',
    );
    expect(describeFollowupError(new ApiError(404, 'NOT_FOUND', 'x'))).toBe(
      'Debrief chưa sẵn sàng.',
    );
  });

  it('falls back to the general messages', () => {
    expect(describeFollowupError(new ApiError(0, 'NETWORK_ERROR', 'x'))).toBe(
      'Không kết nối được tới máy chủ',
    );
    expect(describeFollowupError(new Error('boom'))).toBe('Đã có lỗi, vui lòng thử lại');
  });
});

describe('describeRegenerateError', () => {
  it('maps 409 and 429, and falls back for anything else', () => {
    expect(describeRegenerateError(new ApiError(409, 'CONFLICT', 'x'))).toBe(
      'Cuộc họp chưa kết thúc hoặc không có nội dung.',
    );
    expect(describeRegenerateError(new ApiError(429, 'RATE_LIMITED', 'x'))).toBe(
      'Bạn bấm hơi nhanh, đợi một lát rồi thử lại.',
    );
    expect(describeRegenerateError(new Error('x'))).toBe(
      'Chưa tạo lại được debrief. Hãy thử lại sau.',
    );
  });
});
