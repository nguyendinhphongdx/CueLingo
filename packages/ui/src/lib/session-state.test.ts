import { describe, expect, it } from 'vitest';
import { debriefOutlook, sessionListLabel } from './session-state';

const at = (endedAfterMs: number | null) => ({
  startedAt: '2026-11-01T08:00:00.000Z',
  endedAt:
    endedAfterMs === null
      ? null
      : new Date(Date.parse('2026-11-01T08:00:00.000Z') + endedAfterMs).toISOString(),
});

describe('sessionListLabel', () => {
  it('never promises a debrief to a live meeting', () => {
    expect(sessionListLabel({ status: 'live', ...at(null) })).toBe('Chưa kết thúc');
  });
  it('says there is no content for a meeting that ended at once', () => {
    expect(sessionListLabel({ status: 'ended', ...at(3_000) })).toBe('Không có nội dung');
  });
  it('says the debrief is being made for a longer ended meeting', () => {
    expect(sessionListLabel({ status: 'ended', ...at(600_000) })).toBe('Đang tạo debrief');
  });
  it('says the debrief exists once it does', () => {
    expect(sessionListLabel({ status: 'debriefed', ...at(600_000) })).toBe('Đã có debrief');
  });
});

describe('debriefOutlook', () => {
  it('splits live, empty and pending meetings', () => {
    expect(debriefOutlook({ status: 'live', segments: [{}] })).toBe('live');
    expect(debriefOutlook({ status: 'ended', segments: [] })).toBe('empty');
    expect(debriefOutlook({ status: 'ended', segments: [{}] })).toBe('pending');
  });
});
