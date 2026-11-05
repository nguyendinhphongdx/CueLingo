import type { AgentRepository, AgentTokenUsage } from './agent.repository';

/** In-memory usage for tests; `record` stands in for the `ai_call` events the real gateway hook writes. */
export function createInMemoryAgentRepository(): AgentRepository & {
  record(userId: string, usage: AgentTokenUsage, at?: Date): void;
} {
  const calls: Array<AgentTokenUsage & { userId: string; at: Date }> = [];
  return {
    record(userId, usage, at = new Date()) {
      calls.push({ ...usage, userId, at });
    },
    async tokenUsageSince(userId, since) {
      return calls
        .filter((call) => call.userId === userId && call.at >= since)
        .reduce(
          (sum, call) => ({
            tokens: sum.tokens + call.tokens,
            costUsd: sum.costUsd + call.costUsd,
          }),
          { tokens: 0, costUsd: 0 },
        );
    },
  };
}
