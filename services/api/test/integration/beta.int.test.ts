import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresAdminRepository } from '../../src/modules/admin';
import { createPostgresEventsRepository } from '../../src/modules/events';
import { createPostgresFeedbackRepository } from '../../src/modules/feedback';
import { createPostgresSessionsRepository } from '../../src/modules/sessions';
import { startMigratedPostgres, type TestDatabase } from './postgres';

const NOW = new Date('2026-11-20T12:00:00.000Z');

describe('beta activation, feedback and metrics on real Postgres (AC6-AC9)', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;

  const newUser = async (email: string) =>
    (
      await sql<
        { id: string }[]
      >`INSERT INTO auth_user (name, email) VALUES (${email}, ${email}) RETURNING id`
    )[0]!.id;
  const event = (userId: string, type: string, at: string) =>
    sql`INSERT INTO events (id, user_id, type, at) VALUES (gen_random_uuid(), ${userId}, ${type}, ${at})`;

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
  });
  afterAll(async () => {
    await sql.end();
    await db.stop();
  });

  it('reports nulls, not zeros, while there is no data (AC8)', async () => {
    const { beta } = await createPostgresAdminRepository(sql).metrics(NOW);
    expect(beta).toEqual({
      medianMinutesToFirstCaption: null,
      meetingsPerUserWeek: null,
      d1: null,
      d7: null,
      feedback30d: 0,
    });
  });

  it('writes exactly one session_started event in the statement that creates the meeting (AC7)', async () => {
    const user = await newUser('starter@example.com');
    const session = await createPostgresSessionsRepository(sql).create(user, {
      assistLevel: 3,
      language: 'en',
    });
    const rows = await sql<{ type: string; session_id: string; payload: unknown; at: Date }[]>`
      SELECT type, session_id, payload, at FROM events WHERE user_id = ${user}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'session_started',
      session_id: session.id,
      payload: { language: 'en' },
    });
    expect(rows[0]!.at.toISOString()).toBe(session.startedAt);
  });

  it('keeps the first activation event and drops a resend (AC7)', async () => {
    const user = await newUser('resend@example.com');
    const repo = createPostgresEventsRepository(sql);
    await repo.append(user, [{ type: 'app_installed_first_run', at: '2026-11-01T08:00:00.000Z' }]);
    await repo.append(user, [
      { type: 'app_installed_first_run', at: '2026-11-09T08:00:00.000Z' },
      { type: 'first_caption_shown', at: '2026-11-01T08:05:00.000Z' },
      { type: 'first_caption_shown', at: '2026-11-09T08:05:00.000Z' },
    ]);
    const rows = await sql<{ type: string; at: Date }[]>`
      SELECT type, at FROM events WHERE user_id = ${user} ORDER BY type`;
    expect(rows.map((r) => r.type)).toEqual(['app_installed_first_run', 'first_caption_shown']);
    expect(rows[0]!.at.toISOString()).toBe('2026-11-01T08:00:00.000Z');
  });

  it('stores feedback for the signed-in person only, and removes it with the account (AC6, AC9)', async () => {
    const a = await newUser('fb-a@example.com');
    const b = await newUser('fb-b@example.com');
    const repo = createPostgresFeedbackRepository(sql);
    const input = {
      kind: 'bug',
      message: 'Caption trễ',
      client: 'desktop',
      appVersion: '0.1.1',
      os: 'macOS 15',
    } as const;
    await repo.create(a, input);
    await repo.create(a, input);

    expect(await repo.countSince(a, new Date(Date.now() - 60_000))).toBe(2);
    expect(await repo.countSince(b, new Date(Date.now() - 60_000))).toBe(0);
    const [row] = await sql`SELECT * FROM feedback WHERE user_id = ${a} LIMIT 1`;
    expect(row).toMatchObject({ app_version: '0.1.1', os: 'macOS 15', kind: 'bug' });
    expect(Object.keys(row!)).not.toContain('transcript');

    await sql`DELETE FROM auth_user WHERE id = ${a}`;
    const left = await sql`SELECT 1 FROM feedback WHERE user_id = ${a}`;
    expect(left).toHaveLength(0);
  });

  it('computes median time to first caption, meetings per person, D1, D7 and feedback (AC8)', async () => {
    // Start from a clean slate so only this scenario counts.
    await sql`DELETE FROM events`;
    await sql`DELETE FROM feedback`;
    const u1 = await newUser('m-u1@example.com');
    const u2 = await newUser('m-u2@example.com');
    const u3 = await newUser('m-u3@example.com');

    // u1: caption after 4 min, came back 26 h later (D1) and 7 d + 2 h later (D7), one meeting this week.
    await event(u1, 'app_installed_first_run', '2026-11-05T10:00:00.000Z');
    await event(u1, 'first_caption_shown', '2026-11-05T10:04:00.000Z');
    await event(u1, 'session_started', '2026-11-06T12:00:00.000Z');
    await event(u1, 'session_started', '2026-11-12T12:00:00.000Z');
    await event(u1, 'session_started', '2026-11-18T12:00:00.000Z');
    // u2: caption after 10 min, never came back.
    await event(u2, 'app_installed_first_run', '2026-11-10T09:00:00.000Z');
    await event(u2, 'first_caption_shown', '2026-11-10T09:10:00.000Z');
    // u3: installed a day ago, too new for D1 and D7, no caption yet.
    await event(u3, 'app_installed_first_run', '2026-11-19T12:00:00.000Z');

    const feedback = createPostgresFeedbackRepository(sql);
    const fb = {
      kind: 'idea',
      message: 'Thêm phím tắt',
      client: 'web',
      appVersion: '0.1.1',
      os: 'macOS 15',
    } as const;
    await feedback.create(u1, fb);
    await feedback.create(u2, fb);

    const { beta } = await createPostgresAdminRepository(sql).metrics(NOW);
    expect(beta.medianMinutesToFirstCaption).toBeCloseTo(7, 5);
    expect(beta.meetingsPerUserWeek).toBeCloseTo(1 / 3, 5);
    expect(beta.d1).toBeCloseTo(0.5, 5);
    expect(beta.d7).toBeCloseTo(0.5, 5);
    expect(beta.feedback30d).toBe(2);
  });
});
