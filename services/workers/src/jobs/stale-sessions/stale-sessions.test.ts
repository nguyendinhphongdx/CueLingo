import { JobName, debriefJobOptions } from '@cuelingo/shared';
import { describe, expect, it } from 'vitest';
import {
  STALE_SESSION_MINUTES,
  STALE_SWEEP_CRON,
  closeStaleSessions,
  type StaleSessionsRepository,
} from './index';

const MIN = 60 * 1000;
const NOW = new Date('2026-11-01T12:00:00Z');
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

type Row = {
  id: string;
  status: string;
  startedMinAgo: number;
  lastSegmentEndMs: number | null;
  segments: number;
  endedAt?: Date;
};

function setup(rows: Row[]) {
  const enqueued: Array<{ name: string; payload: unknown; options: unknown }> = [];
  const staleSessions: StaleSessionsRepository = {
    async closeStaleLive(cutoff, limit) {
      const closed: Array<{ id: string; segmentCount: number }> = [];
      for (const row of rows) {
        if (row.status !== 'live' || closed.length >= limit) continue;
        const started = NOW.getTime() - row.startedMinAgo * MIN;
        const last = started + (row.lastSegmentEndMs ?? 0);
        if (last >= cutoff.getTime()) continue;
        row.status = 'ended';
        row.endedAt = new Date(Math.min(last, NOW.getTime()));
        closed.push({ id: row.id, segmentCount: row.segments });
      }
      return closed;
    },
  };
  const queue = {
    async enqueue(name: string, payload: unknown, options?: unknown) {
      enqueued.push({ name, payload, options });
    },
  };
  return { enqueued, deps: { staleSessions, queue: queue as never, now: () => NOW } };
}

describe('closeStaleSessions', () => {
  it('ends a stale live session at its last segment and queues one debrief', async () => {
    const rows: Row[] = [
      {
        id: id(1),
        status: 'live',
        startedMinAgo: 120,
        lastSegmentEndMs: 10 * MIN,
        segments: 19,
      },
    ];
    const { enqueued, deps } = setup(rows);

    expect(await closeStaleSessions(deps)).toEqual({ closed: 1, queued: 1 });
    expect(rows[0]?.status).toBe('ended');
    expect(rows[0]?.endedAt?.getTime()).toBe(NOW.getTime() - 110 * MIN);
    expect(enqueued).toEqual([
      {
        name: JobName.DebriefGenerate,
        payload: { sessionId: id(1) },
        options: debriefJobOptions(id(1)),
      },
    ]);
  });

  it('ends a stale empty session at its start and queues nothing', async () => {
    const rows: Row[] = [
      { id: id(2), status: 'live', startedMinAgo: 90, lastSegmentEndMs: null, segments: 0 },
    ];
    const { enqueued, deps } = setup(rows);

    expect(await closeStaleSessions(deps)).toEqual({ closed: 1, queued: 0 });
    expect(rows[0]?.endedAt?.getTime()).toBe(NOW.getTime() - 90 * MIN);
    expect(enqueued).toEqual([]);
  });

  it('leaves fresh live sessions and sessions in other states alone', async () => {
    const rows: Row[] = [
      { id: id(3), status: 'live', startedMinAgo: 200, lastSegmentEndMs: 190 * MIN, segments: 5 },
      { id: id(4), status: 'live', startedMinAgo: 5, lastSegmentEndMs: null, segments: 0 },
      { id: id(5), status: 'ended', startedMinAgo: 500, lastSegmentEndMs: null, segments: 3 },
      { id: id(6), status: 'debriefed', startedMinAgo: 500, lastSegmentEndMs: null, segments: 3 },
      { id: id(7), status: 'deleted', startedMinAgo: 500, lastSegmentEndMs: null, segments: 3 },
    ];
    const { enqueued, deps } = setup(rows);

    expect(await closeStaleSessions(deps)).toEqual({ closed: 0, queued: 0 });
    expect(rows.map((row) => row.status)).toEqual([
      'live',
      'live',
      'ended',
      'debriefed',
      'deleted',
    ]);
    expect(enqueued).toEqual([]);
  });

  it('is a no-op on the second run', async () => {
    const rows: Row[] = [
      { id: id(1), status: 'live', startedMinAgo: 120, lastSegmentEndMs: 0, segments: 2 },
    ];
    const { enqueued, deps } = setup(rows);

    await closeStaleSessions(deps);
    expect(await closeStaleSessions(deps)).toEqual({ closed: 0, queued: 0 });
    expect(enqueued).toHaveLength(1);
  });

  it('keeps the thresholds in one place', () => {
    expect(STALE_SESSION_MINUTES).toBe(30);
    expect(STALE_SWEEP_CRON).toBe('*/10 * * * *');
  });
});
