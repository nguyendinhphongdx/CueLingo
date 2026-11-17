import { describe, expect, it } from 'vitest';
import { isMeetingLive } from './meeting-live';

describe('isMeetingLive', () => {
  it('is false only when a new meeting may start (idle or error)', () => {
    expect(isMeetingLive('idle')).toBe(false);
    expect(isMeetingLive('error')).toBe(false);
    expect(isMeetingLive('connecting')).toBe(true);
    expect(isMeetingLive('running')).toBe(true);
    expect(isMeetingLive('reconnecting')).toBe(true);
  });
});
