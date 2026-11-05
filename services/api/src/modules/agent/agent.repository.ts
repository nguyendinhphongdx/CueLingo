import type { Sql } from '../../lib/db';

export interface AgentTokenUsage {
  tokens: number;
  costUsd: number;
}

/**
 * Read model of what the assistant has cost a user: the `ai_call` events the gateway hook already writes for
 * task `agent.chat` (no table of its own). Scoped by user.
 */
export interface AgentRepository {
  tokenUsageSince(userId: string, since: Date): Promise<AgentTokenUsage>;
}

export function createPostgresAgentRepository(sql: Sql): AgentRepository {
  return {
    async tokenUsageSince(userId, since) {
      const [row] = await sql<{ tokens: string; cost: string }[]>`
        SELECT
          COALESCE(sum(COALESCE((payload->>'inputTokens')::bigint, 0)
                     + COALESCE((payload->>'outputTokens')::bigint, 0)), 0)::text AS tokens,
          COALESCE(sum(cost_usd), 0)::text AS cost
        FROM events
        WHERE user_id = ${userId} AND type = 'ai_call' AND at >= ${since}
          AND payload->>'task' = 'agent.chat'`;
      return { tokens: Number(row?.tokens ?? 0), costUsd: Number(row?.cost ?? 0) };
    },
  };
}
