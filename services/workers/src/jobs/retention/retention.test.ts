import { describe, expect, it } from 'vitest';
import {
  AUDIO_RETENTION_DAYS,
  DELETED_SESSION_RETENTION_DAYS,
  sweepDeletedSessions,
  sweepExpiredAudio,
  type RetentionRepository,
} from './index';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-01T00:00:00Z');

function setup(segments: Array<{ id: string; key: string | null; startedDaysAgo: number }>) {
  const rows = segments.map((s) => ({ ...s }));
  const deleted: string[] = [];
  const retention: RetentionRepository = {
    async findExpiredAudio(cutoff, limit) {
      return rows
        .filter((r) => r.key !== null && NOW.getTime() - r.startedDaysAgo * DAY < cutoff.getTime())
        .slice(0, limit)
        .map((r) => ({ segmentId: r.id, audioKey: r.key! }));
    },
    async clearAudioKeys(ids) {
      for (const r of rows) if (ids.includes(r.id)) r.key = null;
    },
    async deleteExpiredSessions() {
      return 0;
    },
  };
  const storage = {
    async deleteMany(keys: string[]) {
      deleted.push(...keys);
    },
  };
  return { rows, deleted, deps: { retention, storage, now: () => NOW } };
}

describe('sweepExpiredAudio', () => {
  it('removes audio older than the window and keeps newer audio', async () => {
    const { rows, deleted, deps } = setup([
      { id: 'old', key: 'audio/old', startedDaysAgo: AUDIO_RETENTION_DAYS + 1 },
      { id: 'recent', key: 'audio/recent', startedDaysAgo: AUDIO_RETENTION_DAYS - 1 },
      { id: 'none', key: null, startedDaysAgo: 90 },
    ]);

    const result = await sweepExpiredAudio(deps);

    expect(result.removed).toBe(1);
    expect(deleted).toEqual(['audio/old']);
    expect(rows.find((r) => r.id === 'old')?.key).toBeNull();
    expect(rows.find((r) => r.id === 'recent')?.key).toBe('audio/recent');
  });

  it('is idempotent: a second run changes nothing', async () => {
    const { deleted, deps } = setup([{ id: 'old', key: 'audio/old', startedDaysAgo: 45 }]);

    await sweepExpiredAudio(deps);
    const second = await sweepExpiredAudio(deps);

    expect(second.removed).toBe(0);
    expect(deleted).toEqual(['audio/old']);
  });

  it('keeps the keys when storage fails, so the next run retries', async () => {
    const { rows, deps } = setup([{ id: 'old', key: 'audio/old', startedDaysAgo: 45 }]);
    const failing = {
      ...deps,
      storage: {
        async deleteMany() {
          throw new Error('storage down');
        },
      },
    };

    await expect(sweepExpiredAudio(failing)).rejects.toThrow('storage down');
    expect(rows[0]?.key).toBe('audio/old');
  });
});

describe('sweepDeletedSessions', () => {
  it('hard-deletes only soft-deleted sessions older than seven days and is idempotent', async () => {
    const sessions = [
      { id: 'old-deleted', status: 'deleted', startedDaysAgo: 8 },
      { id: 'recent-deleted', status: 'deleted', startedDaysAgo: 6 },
      { id: 'old-ended', status: 'ended', startedDaysAgo: 30 },
    ];
    const retention: RetentionRepository = {
      async findExpiredAudio() {
        return [];
      },
      async clearAudioKeys() {},
      async deleteExpiredSessions(cutoff, limit) {
        const expired = sessions
          .filter(
            (session) =>
              session.status === 'deleted' &&
              NOW.getTime() - session.startedDaysAgo * DAY < cutoff.getTime(),
          )
          .slice(0, limit);
        for (const session of expired) sessions.splice(sessions.indexOf(session), 1);
        return expired.length;
      },
    };
    const deps = { retention, now: () => NOW };

    expect(await sweepDeletedSessions(deps)).toEqual({ removed: 1 });
    expect(await sweepDeletedSessions(deps)).toEqual({ removed: 0 });
    expect(sessions.map((session) => session.id)).toEqual(['recent-deleted', 'old-ended']);
    expect(DELETED_SESSION_RETENTION_DAYS).toBe(7);
  });
});
