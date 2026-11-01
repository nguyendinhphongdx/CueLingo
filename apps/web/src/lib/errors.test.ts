import { ApiError } from '@cuelingo/core-sdk';
import { describe, expect, it } from 'vitest';
import { describeError } from './errors';

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
