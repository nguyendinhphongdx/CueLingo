import { randomUUID } from 'node:crypto';
import { estimateCostUsd, type AiCallRecord } from '@cuelingo/ai-gateway';
import type { Sql } from './db';

/** Persists one provider attempt and attributes its cost to the related meeting when present. */
export async function recordAiCall(sql: Sql, record: AiCallRecord): Promise<void> {
  const costUsd = estimateCostUsd(record);
  await sql.begin(async (tx) => {
    let userId = record.userId ?? null;
    if (record.sessionId) {
      const [session] = await tx<{ user_id: string }[]>`
        SELECT user_id FROM sessions WHERE id = ${record.sessionId}`;
      if (!session) throw new Error('AI call session not found');
      if (userId && userId !== session.user_id)
        throw new Error('AI call user does not own session');
      userId = session.user_id;
    }
    if (!userId) throw new Error('AI call has no attributable user');

    await tx`
      INSERT INTO events (id, user_id, session_id, type, cost_usd, latency_ms, payload, at)
      VALUES (
        ${randomUUID()}, ${userId}, ${record.sessionId ?? null}, 'ai_call', ${costUsd},
        ${record.latencyMs},
        ${tx.json({
          task: record.task,
          model: record.model,
          fallback: record.fallback,
          ok: record.ok,
          // The assistant's daily token quota is summed from these.
          ...(record.inputTokens !== undefined ? { inputTokens: record.inputTokens } : {}),
          ...(record.outputTokens !== undefined ? { outputTokens: record.outputTokens } : {}),
        })},
        now()
      )`;
    if (record.sessionId && costUsd !== null) {
      await tx`
        UPDATE sessions SET cost_usd = cost_usd + ${costUsd}
        WHERE id = ${record.sessionId}`;
    }
  });
}

/** Non-blocking gateway hook. Persistence failures are reported but never reject an AI request. */
export function createAiCallHook(
  sql: Sql,
  onError: (error: unknown, record: AiCallRecord) => void,
): (record: AiCallRecord) => void {
  return (record) => {
    void recordAiCall(sql, record).catch((error: unknown) => {
      try {
        onError(error, record);
      } catch {
        // Logging must not become a second failure path.
      }
    });
  };
}
