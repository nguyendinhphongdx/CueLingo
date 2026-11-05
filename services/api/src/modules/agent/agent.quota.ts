import type { AgentQuota } from '@cuelingo/shared';

/** Daily allowance of one person (plan ai-agent, "Quota mặc định"); overridable by env. */
export interface AgentQuotaLimits {
  turns: number;
  tokens: number;
  costUsd: number;
}

export const DEFAULT_QUOTA_LIMITS: AgentQuotaLimits = {
  turns: 60,
  tokens: 400_000,
  costUsd: 0.25,
};

export interface AgentUsage {
  turns: number;
  tokens: number;
  costUsd: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The day is the UTC calendar day: simple to explain and to query, and `resetsAt - 24h` is its start. */
export function quotaWindow(now: Date): { since: Date; resetsAt: Date } {
  const since = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS);
  return { since, resetsAt: new Date(since.getTime() + DAY_MS) };
}

export function toQuota(usage: AgentUsage, limits: AgentQuotaLimits, resetsAt: Date): AgentQuota {
  return {
    turns: { used: usage.turns, limit: limits.turns },
    tokens: { used: usage.tokens, limit: limits.tokens },
    costUsd: { used: usage.costUsd, limit: limits.costUsd },
    resetsAt: resetsAt.toISOString(),
  };
}

export const isExceeded = (usage: AgentUsage, limits: AgentQuotaLimits): boolean =>
  usage.turns >= limits.turns || usage.tokens >= limits.tokens || usage.costUsd >= limits.costUsd;
