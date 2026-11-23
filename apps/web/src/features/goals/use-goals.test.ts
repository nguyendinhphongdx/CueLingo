import { ApiError } from '@cuelingo/core-sdk';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/client', () => ({ client: { goals: {} } }));

import { goalErrorMessage, toCreateRequest, toUpdateRequest } from './use-goals';

describe('toCreateRequest', () => {
  it('sends no level and no deadline when the person left them alone', () => {
    expect(toCreateRequest({ goalKey: 'standup', level: null, deadline: null })).toEqual({
      goalKey: 'standup',
    });
  });
  it('sends what the person set', () => {
    expect(toCreateRequest({ goalKey: 'demo', level: 'b2', deadline: '2026-12-01' })).toEqual({
      goalKey: 'demo',
      level: 'b2',
      deadline: '2026-12-01',
    });
  });
});

describe('toUpdateRequest', () => {
  const current = { level: 'b1', deadline: '2026-12-01' };
  it('sends only what changed, and nothing when nothing did', () => {
    expect(toUpdateRequest(current, { level: 'b1', deadline: '2026-12-01' })).toBeNull();
    expect(toUpdateRequest(current, { level: 'c1', deadline: '2026-12-01' })).toEqual({
      level: 'c1',
    });
    expect(toUpdateRequest(current, { level: 'b1', deadline: null })).toEqual({ deadline: null });
  });
});

describe('goalErrorMessage (AC9)', () => {
  it('explains a lesson that could not be made, and an allowance used up, in Vietnamese', () => {
    expect(goalErrorMessage(new ApiError(502, 'LESSON_FAILED', 'x'), 'open')).toContain(
      'Bài mới chưa soạn được',
    );
    const quota = new ApiError(429, 'QUOTA_EXCEEDED', 'x', {
      metric: 'lesson_practice_daily',
      resetsAt: '2026-11-23T17:00:00.000Z',
    });
    expect(goalErrorMessage(quota, 'practice')).toContain('lượt góp ý câu luyện hôm nay');
  });
  it('falls back for an error that is not from the API', () => {
    expect(goalErrorMessage(new Error('boom'), 'quiz')).toBe(
      'Chưa nộp được bài kiểm tra. Thử lại sau.',
    );
  });
});
