import type { AiGateway } from '@cuelingo/ai-gateway';
import type { DebriefContent } from '@cuelingo/shared';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresDebriefRepository, generateDebrief } from '../../src/jobs/debrief';
import { startMigratedPostgres, type TestDatabase } from './postgres';

const content: DebriefContent = {
  summary: { headlineVi: 'Kế hoạch phát hành', bulletsVi: [] },
  actionItems: [],
  hardSegmentIds: [],
  phraseSuggestions: [],
  rephrase: [],
  comprehensionPct: 75,
};

describe('debrief.generate on real Postgres', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let sessionId: string;

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    const [user] = await sql<
      { id: string }[]
    >`INSERT INTO auth_user (name, email) VALUES ('u', 'debrief@example.com') RETURNING id`;
    const [session] = await sql<{ id: string }[]>`
      INSERT INTO sessions (user_id, assist_level, status)
      VALUES (${user!.id}, 4, 'ended') RETURNING id`;
    sessionId = session!.id;
    for (let index = 0; index < 5; index += 1) {
      await sql`
        INSERT INTO segments (session_id, source, start_ms, end_ms, text_en)
        VALUES (${sessionId}, ${index % 2 ? 'mic' : 'system'}, ${index * 1000}, ${(index + 1) * 1000}, ${`Sentence ${index}`})`;
    }
  });

  afterAll(async () => {
    if (sql) await sql.end();
    if (db) await db.stop();
  });

  it('stores each version and marks the session debriefed atomically', async () => {
    const ai = { json: async () => content } as unknown as Pick<AiGateway, 'json'>;
    const deps = {
      debrief: createPostgresDebriefRepository(sql),
      ai,
      log: { warn: () => {} },
    };

    await generateDebrief(deps, { sessionId });
    await generateDebrief(deps, { sessionId });

    const rows = await sql<
      Array<{ version: number; prompt_version: string; headline: string }>
    >`SELECT version, prompt_version, summary->>'headlineVi' AS headline FROM debriefs ORDER BY version`;
    const [session] = await sql<{ status: string }[]>`
      SELECT status FROM sessions WHERE id = ${sessionId}`;
    expect(rows).toEqual([
      { version: 1, prompt_version: 'debrief.generate@v4', headline: 'Kế hoạch phát hành' },
      { version: 2, prompt_version: 'debrief.generate@v4', headline: 'Kế hoạch phát hành' },
    ]);
    expect(session?.status).toBe('debriefed');
  });

  it('reads speaker label and name through segments.speaker_id; sentences without one stay null', async () => {
    const [speaker] = await sql<{ id: string }[]>`
      INSERT INTO speakers (session_id, label, display_name)
      VALUES (${sessionId}, 'speaker_1', 'Lan') RETURNING id`;
    await sql`
      UPDATE segments SET speaker_id = ${speaker!.id}
      WHERE id = (SELECT id FROM segments WHERE session_id = ${sessionId} ORDER BY start_ms LIMIT 1)`;

    const found = await createPostgresDebriefRepository(sql).findSession(sessionId);

    expect(found?.segments[0]).toMatchObject({ speakerLabel: 'speaker_1', speakerName: 'Lan' });
    expect(found?.segments[1]).toMatchObject({ speakerLabel: null, speakerName: null });
  });
});
