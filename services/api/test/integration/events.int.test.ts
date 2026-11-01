import type { LearningEvent } from '@cuelingo/shared';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresEventsRepository } from '../../src/modules/events';
import { startMigratedPostgres, type TestDatabase } from './postgres';

const AT = '2026-11-02T09:00:00.000Z';

describe('events on real Postgres (AC4)', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let alice: string;
  let bob: string;
  let aliceSession: string;
  let aliceSegment: string;

  const newUser = async (email: string) =>
    (
      await sql<
        { id: string }[]
      >`INSERT INTO auth_user (name, email) VALUES (${email}, ${email}) RETURNING id`
    )[0]!.id;

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    alice = await newUser('events-alice@example.com');
    bob = await newUser('events-bob@example.com');
    const [session] = await sql<{ id: string }[]>`
      INSERT INTO sessions (user_id, assist_level) VALUES (${alice}, 4) RETURNING id`;
    const [segment] = await sql<{ id: string }[]>`
      INSERT INTO segments (session_id, source, start_ms, end_ms, text_en)
      VALUES (${session!.id}, 'system', 0, 1000, 'A roadmap') RETURNING id`;
    aliceSession = session!.id;
    aliceSegment = segment!.id;
  });
  afterAll(async () => {
    await sql.end();
    await db.stop();
  });

  it('writes every event with the authenticated user and mapped payload', async () => {
    const repo = createPostgresEventsRepository(sql);
    const events: LearningEvent[] = [
      { type: 'lookup', term: 'roadmap', sessionId: aliceSession, at: AT },
      { type: 'translation_expanded', segmentId: aliceSegment, at: AT },
      { type: 'compose_used', chosenIndex: 1, at: AT },
    ];

    await repo.append(alice, events);

    const rows = await sql<
      Array<{
        user_id: string;
        session_id: string | null;
        segment_id: string | null;
        type: string;
        payload: Record<string, unknown>;
      }>
    >`SELECT user_id, session_id, segment_id, type, payload FROM events ORDER BY type`;
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.user_id === alice)).toBe(true);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'lookup',
          session_id: aliceSession,
          payload: { term: 'roadmap' },
        }),
        expect.objectContaining({ type: 'translation_expanded', segment_id: aliceSegment }),
        expect.objectContaining({ type: 'compose_used', payload: { chosenIndex: 1 } }),
      ]),
    );
  });

  it("rejects another user's session and segment without writing anything", async () => {
    const repo = createPostgresEventsRepository(sql);
    const count = async () =>
      Number((await sql<{ count: string }[]>`SELECT count(*) FROM events`)[0]!.count);
    const before = await count();

    await expect(
      repo.append(bob, [{ type: 'lookup', term: 'roadmap', sessionId: aliceSession, at: AT }]),
    ).rejects.toThrow('Event session not found');
    await expect(
      repo.append(bob, [{ type: 'translation_expanded', segmentId: aliceSegment, at: AT }]),
    ).rejects.toThrow('Event segment not found');
    expect(await count()).toBe(before);
  });
});
