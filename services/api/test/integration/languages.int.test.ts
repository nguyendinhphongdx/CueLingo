import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPostgresPhrasesRepository,
  createPostgresStudyRepository,
} from '../../src/modules/review';
import { startMigratedPostgres, type TestDatabase } from './postgres';

describe('learning data per language on real Postgres', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let user: string;
  let japaneseSession: string;

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    const [owner] = await sql<{ id: string }[]>`
      INSERT INTO auth_user (name, email) VALUES ('lang', 'lang@example.com') RETURNING id`;
    user = owner!.id;
    const [meeting] = await sql<{ id: string }[]>`
      INSERT INTO sessions (user_id, assist_level, language) VALUES (${user}, 4, 'ja')
      RETURNING id`;
    japaneseSession = meeting!.id;
  });
  afterAll(async () => {
    await sql.end();
    await db.stop();
  });

  it('files a phrase under the language of the meeting it came from', async () => {
    const phrases = createPostgresPhrasesRepository(sql);
    await phrases.save(user, { phrase: 'hello', sessionId: japaneseSession });
    await phrases.save(user, { phrase: 'hello' });

    expect((await phrases.list(user, 'ja')).map((phrase) => phrase.phrase)).toEqual(['hello']);
    expect((await phrases.list(user, 'en')).map((phrase) => phrase.phrase)).toEqual(['hello']);
    const [row] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM lexical_items WHERE lemma = 'hello'`;
    expect(row?.count).toBe(2);
  });

  it('counts meetings and phrases of one language only', async () => {
    const study = createPostgresStudyRepository(sql);
    const since = new Date(Date.now() - 86_400_000);

    expect((await study.listItems(user, 'ja')).length).toBe(1);
    expect((await study.listItems(user)).length).toBe(2);
    expect((await study.progressFacts(user, 'ja', since)).meetingStarts.length).toBe(1);
    expect((await study.progressFacts(user, 'en', since)).meetingStarts.length).toBe(0);
  });
});
