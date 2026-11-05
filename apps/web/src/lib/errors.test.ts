import { ApiError } from '@cuelingo/core-sdk';
import { describe, expect, it } from 'vitest';
import {
  describeAgentError,
  describeAgentErrorCode,
  describeError,
  describeFollowupError,
  describeRegenerateError,
  formatClock,
} from './errors';

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

describe('describeAgentError', () => {
  const quota = {
    turns: { used: 60, limit: 60 },
    tokens: { used: 10, limit: 400000 },
    costUsd: { used: 0.01, limit: 0.25 },
    resetsAt: '2026-11-06T00:00:00.000Z',
  };

  it('says the assistant is busy on 409', () => {
    expect(describeAgentError(new ApiError(409, 'CONFLICT', 'busy'))).toContain('đang trả lời');
  });

  it('explains the daily quota and when it resets, from the error details', () => {
    const message = describeAgentError(new ApiError(429, 'AGENT_QUOTA_EXCEEDED', 'limit', quota));
    expect(message).toContain('60 lượt');
    expect(message).toMatch(/lúc \d{2}:\d{2}/);
  });

  it('still explains the quota when details are missing', () => {
    expect(describeAgentError(new ApiError(429, 'AGENT_QUOTA_EXCEEDED', 'limit'))).toContain(
      'hết lượt',
    );
  });

  it('says the assistant is off on 503, offline on network errors, and never shows server text', () => {
    expect(describeAgentError(new ApiError(503, 'AGENT_DISABLED', 'GEMINI_API_KEY missing'))).toBe(
      'Trợ lý AI đang tạm tắt. Hãy quay lại sau.',
    );
    expect(describeAgentError(new ApiError(0, 'NETWORK_ERROR', 'fetch failed'))).toContain(
      'Mất kết nối',
    );
    expect(describeAgentError(new Error('boom'))).toBe('Đã có lỗi, vui lòng thử lại');
  });

  it('formats the reset time as HH:mm in the given zone', () => {
    expect(formatClock('2026-11-06T00:00:00.000Z', 'Asia/Ho_Chi_Minh')).toBe('07:00');
  });

  it('maps in-stream error codes', () => {
    expect(describeAgentErrorCode('AGENT_FAILED')).toContain('gặp sự cố');
  });
});
