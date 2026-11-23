import { ApiError } from '@cuelingo/core-sdk';
import { describe, expect, it } from 'vitest';
import { goalErrorMessage, toCreateRequest, toUpdateRequest } from './use-goals';

describe('goal requests', () => {
  it('leaves out the level and deadline the person did not set', () => {
    expect(toCreateRequest({ goalKey: 'standup', level: null, deadline: null })).toEqual({
      goalKey: 'standup',
    });
    expect(toCreateRequest({ goalKey: 'demo', level: 'b2', deadline: '2026-12-01' })).toEqual({
      goalKey: 'demo',
      level: 'b2',
      deadline: '2026-12-01',
    });
  });

  it('sends only what changed, and nothing when nothing did', () => {
    const current = { level: 'b1', deadline: null };
    expect(toUpdateRequest(current, { level: 'b1', deadline: null })).toBeNull();
    expect(toUpdateRequest(current, { level: 'c1', deadline: null })).toEqual({ level: 'c1' });
    expect(toUpdateRequest(current, { level: null, deadline: '2026-12-01' })).toEqual({
      deadline: '2026-12-01',
    });
  });

  it('turns any error into Vietnamese text', () => {
    expect(goalErrorMessage(new Error('boom'), 'list').length).toBeGreaterThan(0);
    expect(typeof goalErrorMessage(new ApiError(500, 'LESSON_FAILED', 'x'), 'open')).toBe('string');
  });
});
