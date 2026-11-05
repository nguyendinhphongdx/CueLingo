import { describe, expect, it } from 'vitest';
import {
  AUDIO_RETENTION_DAYS,
  DELETED_CONVERSATION_RETENTION_DAYS,
  DELETED_SESSION_RETENTION_DAYS,
  STALE_STREAMING_MINUTES,
  sweepDeletedConversations,
  sweepDeletedSessions,
  sweepExpiredAudio,
  sweepStaleStreamingMessages,
  type RetentionRepository,
} from './index';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-01T00:00:00Z');
const noConversations = {
  async deleteExpiredConversations() {
    return 0;
  },
  async failStaleStreamingMessages() {
    return 0;
  },
};

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
    ...noConversations,
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
      ...noConversations,
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

describe('assistant conversation retention', () => {
  interface Conversation {
    id: string;
    deletedDaysAgo: number | null;
    messages: Array<{ id: string; status: string; ageMinutes: number }>;
  }

  function setup(conversations: Conversation[]) {
    const rows = [...conversations];
    const retention: RetentionRepository = {
      async findExpiredAudio() {
        return [];
      },
      async clearAudioKeys() {},
      async deleteExpiredSessions() {
        return 0;
      },
      async deleteExpiredConversations(cutoff, limit) {
        const expired = rows
          .filter(
            (c) =>
              c.deletedDaysAgo !== null &&
              NOW.getTime() - c.deletedDaysAgo * DAY < cutoff.getTime(),
          )
          .slice(0, limit);
        // Messages go with their conversation (ON DELETE CASCADE).
        for (const c of expired) rows.splice(rows.indexOf(c), 1);
        return expired.length;
      },
      async failStaleStreamingMessages(cutoff) {
        let marked = 0;
        for (const c of rows) {
          for (const m of c.messages) {
            if (
              m.status === 'streaming' &&
              NOW.getTime() - m.ageMinutes * 60_000 < cutoff.getTime()
            ) {
              m.status = 'error';
              marked += 1;
            }
          }
        }
        return marked;
      },
    };
    return { rows, deps: { retention, now: () => NOW } };
  }

  it('hard-deletes only conversations soft-deleted more than seven days ago, with their messages, and is idempotent', async () => {
    const { rows, deps } = setup([
      {
        id: 'old-deleted',
        deletedDaysAgo: 8,
        messages: [{ id: 'm1', status: 'complete', ageMinutes: 9000 }],
      },
      { id: 'recent-deleted', deletedDaysAgo: 6, messages: [] },
      { id: 'alive', deletedDaysAgo: null, messages: [] },
    ]);

    expect(await sweepDeletedConversations(deps)).toEqual({ removed: 1 });
    expect(await sweepDeletedConversations(deps)).toEqual({ removed: 0 });
    expect(rows.map((c) => c.id)).toEqual(['recent-deleted', 'alive']);
    expect(DELETED_CONVERSATION_RETENTION_DAYS).toBe(7);
  });

  it('marks messages stuck in streaming for over ten minutes as error and leaves the rest', async () => {
    const { rows, deps } = setup([
      {
        id: 'c',
        deletedDaysAgo: null,
        messages: [
          { id: 'stale', status: 'streaming', ageMinutes: STALE_STREAMING_MINUTES + 1 },
          { id: 'live', status: 'streaming', ageMinutes: STALE_STREAMING_MINUTES - 1 },
          { id: 'done', status: 'complete', ageMinutes: 600 },
        ],
      },
    ]);

    expect(await sweepStaleStreamingMessages(deps)).toEqual({ marked: 1 });
    expect(await sweepStaleStreamingMessages(deps)).toEqual({ marked: 0 });
    expect(rows[0]?.messages.map((m) => [m.id, m.status])).toEqual([
      ['stale', 'error'],
      ['live', 'streaming'],
      ['done', 'complete'],
    ]);
  });
});
