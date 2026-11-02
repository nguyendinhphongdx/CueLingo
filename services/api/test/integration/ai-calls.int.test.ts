import type { AiCallRecord } from '@cuelingo/ai-gateway';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { recordAiCall } from '../../src/lib/ai-calls';
import { startMigratedPostgres, type TestDatabase } from './postgres';

describe('AI call observability on real Postgres', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let userId: string;
  let sessionId: string;

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO auth_user (name, email) VALUES ('u', 'ai-call@example.com') RETURNING id`;
    userId = user!.id;
    const [session] = await sql<{ id: string }[]>`
      INSERT INTO sessions (user_id, assist_level) VALUES (${userId}, 4) RETURNING id`;
    sessionId = session!.id;
  });

  afterAll(async () => {
    if (sql) await sql.end();
    if (db) await db.stop();
  });

  it('writes one event and increments the related session cost', async () => {
    const record: AiCallRecord = {
      task: 'translate.realtime',
      model: 'gemini-3.1-flash-lite',
      promptVersion: 'translate.realtime@v1',
      latencyMs: 321,
      inputTokens: 2_000_000,
      outputTokens: 1_000_000,
      fallback: false,
      ok: true,
      userId,
      sessionId,
    };
    await recordAiCall(sql, record);

    const [event] = await sql<
      Array<{
        type: string;
        cost_usd: string;
        latency_ms: number;
        payload: Record<string, unknown>;
      }>
    >`SELECT type, cost_usd, latency_ms, payload FROM events WHERE session_id = ${sessionId}`;
    const [session] = await sql<{ cost_usd: string }[]>`
      SELECT cost_usd FROM sessions WHERE id = ${sessionId}`;
    expect(event).toMatchObject({
      type: 'ai_call',
      cost_usd: '2.000000',
      latency_ms: 321,
      payload: {
        task: 'translate.realtime',
        model: 'gemini-3.1-flash-lite',
        fallback: false,
        ok: true,
      },
    });
    expect(session?.cost_usd).toBe('2.0000');
  });
});
