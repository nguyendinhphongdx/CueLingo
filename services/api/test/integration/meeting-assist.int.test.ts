import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresMeetingAssistRepository } from '../../src/modules/meeting-assist';
import { createPostgresPrivacyRepository } from '../../src/modules/privacy';
import { startMigratedPostgres, type TestDatabase } from './postgres';

/** AC10, AC16, AC17 on the real queries. */
describe('meeting assistant on real Postgres', () => {
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

  async function meeting(userId: string, lines: Array<[string, string | null]>, title = 'Sync') {
    const [session] = await sql<{ id: string }[]>`
      INSERT INTO sessions (user_id, title, assist_level, status)
      VALUES (${userId}, ${title}, 3, 'ended') RETURNING id`;
    const segments: string[] = [];
    for (const [index, [text, translation]] of lines.entries()) {
      const [segment] = await sql<{ id: string }[]>`
        INSERT INTO segments (session_id, source, start_ms, end_ms, text_en, text_vi)
        VALUES (${session!.id}, 'system', ${index * 1000}, ${index * 1000 + 900}, ${text}, ${translation})
        RETURNING id`;
      segments.push(segment!.id);
    }
    return { id: session!.id, segments };
  }

  const since = new Date(0);

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    alice = await newUser('meeting-alice@example.com');
    bob = await newUser('meeting-bob@example.com');
  });
  afterAll(async () => {
    await sql.end();
    await db.stop();
  });

  it('finds English, Vietnamese and Japanese text of this person only', async () => {
    const repo = createPostgresMeetingAssistRepository(sql);
    const past = await meeting(alice, [
      ['Before.', null],
      ['The Falcon budget is set.', 'Đã chốt Ngân Sách.'],
      ['予算は来週決めます。', null],
    ]);
    await meeting(bob, [['The Falcon budget of Bob.', null]]);
    const now = await meeting(alice, [['Falcon again.', null]]);

    for (const keyword of ['falcon', 'ngân sách', '予算']) {
      const found = await repo.searchPast(alice, {
        excludeSessionId: now.id,
        keywords: [keyword],
        since,
      });
      expect(found.hits.length).toBeGreaterThan(0);
      expect(new Set(found.hits.map((hit) => hit.sessionId))).toEqual(new Set([past.id]));
    }
    const lines = await repo.linesAround(alice, past.id, [past.segments[1]!]);
    expect(lines.map((line) => line.text)).toEqual([
      'Before.',
      'The Falcon budget is set.',
      '予算は来週決めます。',
    ]);
    expect(await repo.linesAround(bob, past.id, [past.segments[1]!])).toEqual([]);
  });

  it('treats % and _ in a question as text', async () => {
    const repo = createPostgresMeetingAssistRepository(sql);
    const now = await meeting(alice, []);
    const found = await repo.searchPast(alice, {
      excludeSessionId: now.id,
      keywords: ['%%%', '___'],
      since,
    });
    expect(found.hits).toEqual([]);
  });

  it('matches the words of a debrief, not the field names of its JSON', async () => {
    const repo = createPostgresMeetingAssistRepository(sql);
    const dave = await newUser('meeting-dave@example.com');
    const past = await meeting(dave, []);
    await sql`
      INSERT INTO debriefs (session_id, summary, action_items, prompt_version)
      VALUES (${past.id}, ${sql.json({ headlineVi: 'Ăn trưa', bulletsVi: ['Đặt bàn'] })},
        ${sql.json([{ textVi: 'Gọi quán', owner: 'Lan', kind: 'decision' }])}, 'v')`;
    const now = await meeting(dave, []);
    const found = await repo.searchPast(dave, {
      excludeSessionId: now.id,
      keywords: ['decision'],
      since,
    });
    expect(found.sessions[0]!.debriefText).toBe('Ăn trưa Đặt bàn Gọi quán Lan');
  });

  it('gives up on a slow search instead of failing the question', async () => {
    const repo = createPostgresMeetingAssistRepository(sql);
    const now = await meeting(alice, []);
    await meeting(alice, [['Falcon.', null]]);
    await sql.begin(async (tx) => {
      await tx`LOCK TABLE segments IN ACCESS EXCLUSIVE MODE`;
      expect(
        await repo.searchPast(alice, { excludeSessionId: now.id, keywords: ['falcon'], since }),
      ).toEqual({ sessions: [], hits: [], timedOut: true });
    });
  });

  it('numbers questions per meeting and keeps them from other people', async () => {
    const repo = createPostgresMeetingAssistRepository(sql);
    const mine = await meeting(alice, []);
    expect(
      await repo.createQuestion(bob, mine.id, { question: 'q', promptVersion: 'v' }),
    ).toBeNull();
    const first = await repo.createQuestion(alice, mine.id, { question: 'q1', promptVersion: 'v' });
    await repo.createQuestion(alice, mine.id, { question: 'q2', promptVersion: 'v' });
    await repo.finishQuestion(bob, first!, { answer: 'hijack', sources: [], status: 'complete' });
    expect(await repo.recentAnswers(alice, mine.id, 3)).toEqual([]);
    await repo.finishQuestion(alice, first!, {
      answer: 'a1',
      sources: [{ kind: 'general' }],
      status: 'complete',
    });
    expect(await repo.recentAnswers(alice, mine.id, 3)).toEqual([{ question: 'q1', answer: 'a1' }]);
    expect(await repo.recentAnswers(bob, mine.id, 3)).toEqual([]);
  });

  it('exports on request and deletes with the data of the person (AC17)', async () => {
    const repo = createPostgresMeetingAssistRepository(sql);
    const privacy = createPostgresPrivacyRepository(sql);
    const carol = await newUser('meeting-carol@example.com');
    const mine = await meeting(carol, []);
    await repo.grantConsent(carol, 'meeting-assist@v1');
    await repo.createQuestion(carol, mine.id, { question: 'q', promptVersion: 'v' });

    const plain = await privacy.exportMyData(carol, new Date());
    expect(plain.sessions[0]).not.toHaveProperty('questions');
    const full = await privacy.exportMyData(carol, new Date(), { meetingQuestions: true });
    expect(full.sessions[0]!.questions).toMatchObject([{ question: 'q', status: 'error' }]);

    await privacy.deleteMyData(carol);
    expect(await repo.consentVersion(carol)).toBeNull();
    const [row] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM meeting_questions WHERE user_id = ${carol}`;
    expect(row!.n).toBe(0);
  });
});
