import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresSessionsRepository } from '../../src/modules/sessions';
import { createPostgresSpeakersRepository } from '../../src/modules/speakers';
import { startMigratedPostgres, type TestDatabase } from './postgres';

describe('sessions on real Postgres (AC7)', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let alice: string;
  let bob: string;

  const newUser = async (email: string) =>
    (
      await sql<
        { id: string }[]
      >`INSERT INTO auth_user (name, email) VALUES (${email}, ${email}) RETURNING id`
    )[0]!.id;

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    alice = await newUser('sessions-alice@example.com');
    bob = await newUser('sessions-bob@example.com');
  });
  afterAll(async () => {
    await sql.end();
    await db.stop();
  });

  it('keeps sessions, details, ending and segments within the owning user', async () => {
    const repo = createPostgresSessionsRepository(sql);
    const session = await repo.create(alice, { title: 'Private meeting', assistLevel: 3 });

    expect(await repo.findById(bob, session.id)).toBeNull();
    expect(await repo.findDetail(bob, session.id)).toBeNull();
    expect(await repo.end(bob, session.id)).toBeNull();
    expect(
      await repo.saveSegment({
        sessionId: session.id,
        userId: bob,
        segmentId: 'c67ef96d-7890-49a7-9a55-66c49272e38f',
        source: 'system',
        startMs: 0,
        endMs: 900,
        textEn: 'Secret',
      }),
    ).toBe(false);
    expect(await repo.list(bob)).toEqual([]);
    expect((await repo.findById(alice, session.id))?.status).toBe('live');
  });

  it('stores speaker labels once per meeting, keeps them within the owner and shows renamed people', async () => {
    const repo = createPostgresSessionsRepository(sql);
    const speakers = createPostgresSpeakersRepository(sql);
    const session = await repo.create(alice, { assistLevel: 0, language: 'vi' });
    const segment = (id: string, source: 'mic' | 'system', speaker?: 'me' | 'speaker_1') => ({
      sessionId: session.id,
      userId: alice,
      segmentId: id,
      source,
      startMs: 0,
      endMs: 900,
      textEn: 'xin chào',
      speaker,
    });
    const ids = [
      '5a1b0c1e-0000-4000-8000-000000000001',
      '5a1b0c1e-0000-4000-8000-000000000002',
      '5a1b0c1e-0000-4000-8000-000000000003',
      '5a1b0c1e-0000-4000-8000-000000000004',
    ] as const;

    expect(await repo.saveSegment(segment(ids[0], 'mic', 'me'))).toBe(true);
    expect(await repo.saveSegment(segment(ids[1], 'system', 'speaker_1'))).toBe(true);
    expect(await repo.saveSegment(segment(ids[2], 'system', 'speaker_1'))).toBe(true);
    expect(await repo.saveSegment(segment(ids[3], 'system'))).toBe(true);
    // Bob cannot attach a label to Alice's meeting, and no speaker row appears for it.
    expect(await repo.saveSegment({ ...segment(ids[3], 'system', 'speaker_1'), userId: bob })).toBe(
      false,
    );

    const detail = (await repo.findDetail(alice, session.id))!;
    expect(detail.speakers.map((speaker) => speaker.label)).toEqual(['me', 'speaker_1']);
    const other = detail.speakers.find((speaker) => speaker.label === 'speaker_1')!;
    expect(detail.segments.filter((item) => item.speakerId === other.id)).toHaveLength(2);
    expect(detail.segments.filter((item) => item.speakerId === null)).toHaveLength(1);

    expect(await speakers.rename(bob, session.id, other.id, 'Hacker')).toBeNull();
    expect((await speakers.rename(alice, session.id, other.id, 'Lan'))?.displayName).toBe('Lan');
    const me = detail.speakers.find((speaker) => speaker.label === 'me')!;
    expect(await speakers.rename(alice, session.id, me.id, 'Phong')).toBeNull();
    const renamed = (await repo.findDetail(alice, session.id))!;
    expect(renamed.speakers.find((speaker) => speaker.id === other.id)?.displayName).toBe('Lan');
    expect(await repo.findDetail(bob, session.id)).toBeNull();
  });
});
