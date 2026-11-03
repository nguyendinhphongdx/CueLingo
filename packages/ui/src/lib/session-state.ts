/** The session statuses a client sees (mirrors `SessionStatus` in @cuelingo/shared). */
type SessionStatus = 'live' | 'ended' | 'debriefed' | 'deleted';

/** Shown where a meeting has no sentences, so it will never get a debrief. Same words on every client. */
export const EMPTY_MEETING_TEXT = 'Cuộc họp này không có câu nào được ghi nên không có debrief.';
/** Shown where a meeting has not ended, so it has no debrief yet. */
export const LIVE_MEETING_TEXT = 'Cuộc họp này chưa kết thúc. Debrief sẽ có sau khi cuộc họp dừng.';

/** An ended meeting this short, with no debrief, is taken to have no sentences (the list has no count). */
export const EMPTY_MEETING_MAX_MS = 10_000;

/** What a meeting's debrief can do: wait for the end, never come, or be on its way. */
export type DebriefOutlook = 'live' | 'empty' | 'pending';

/** The outlook from a meeting that carries its segments (the detail). */
export function debriefOutlook(session: {
  status: SessionStatus;
  segments: readonly unknown[];
}): DebriefOutlook {
  if (session.status === 'live') return 'live';
  return session.segments.length === 0 ? 'empty' : 'pending';
}

/**
 * The label for a meeting in a list. The list does not carry the segment count, so a meeting that
 * ended within `EMPTY_MEETING_MAX_MS` of starting is taken to be empty.
 */
export function sessionListLabel(session: {
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
}): string {
  switch (session.status) {
    case 'live':
      return 'Chưa kết thúc';
    case 'debriefed':
      return 'Đã có debrief';
    case 'deleted':
      return 'Đã xoá';
    case 'ended': {
      const lasted = session.endedAt
        ? Date.parse(session.endedAt) - Date.parse(session.startedAt)
        : Number.POSITIVE_INFINITY;
      return lasted < EMPTY_MEETING_MAX_MS ? 'Không có nội dung' : 'Đang tạo debrief';
    }
  }
}
