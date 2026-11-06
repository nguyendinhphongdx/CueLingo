/**
 * Agent — one assistant turn per request: tools, quota, one turn at a time per conversation, SSE stream.
 * The loop itself is `@cuelingo/agent` (ADR 0018); conversations and messages live in `modules/conversations`.
 * Design: apps/docs/docs/04-modules/03-api/agent.md · Convention: apps/docs/docs/05-engineering/conventions/api-module.md
 */
import type { AiGateway } from '@cuelingo/ai-gateway';
import type { TurnLimits } from '@cuelingo/agent';
import type { LanguageCode, LookupRequest, LookupResponse, Phrase } from '@cuelingo/shared';
import type { ConversationsRepository } from '../conversations';
import type { AgentRepository } from './agent.repository';
import { createGatewayModel } from './agent.model';
import type { AgentQuotaLimits } from './agent.quota';
import { agentRoutes } from './agent.routes';
import { createAgentService } from './agent.service';
import { corePlugin } from './plugins/core';
import { exercisePlugin } from './plugins/exercise';

export interface AgentDeps {
  /** False answers every turn with 503 `AGENT_DISABLED` (env `AGENT_ENABLED`, or no AI key). */
  enabled: boolean;
  gateway?: Pick<AiGateway, 'chat'>;
  quota?: Partial<AgentQuotaLimits>;
  limits?: Partial<TurnLimits>;
  clock?: () => Date;
}

/** The other modules' operations the `core` plugin uses; wired in `app.ts`. */
export interface AgentWiring {
  conversations: ConversationsRepository;
  usage: AgentRepository;
  lookup?: (userId: string, input: LookupRequest) => Promise<LookupResponse>;
  phrases: {
    list(userId: string, language: LanguageCode): Promise<Phrase[]>;
    save(
      userId: string,
      input: { phrase: string; meaningVi?: string; context?: string; language: LanguageCode },
    ): Promise<Phrase>;
  };
}

export function createAgentModule(deps: AgentDeps, wiring: AgentWiring) {
  const { gateway } = deps;
  const service = createAgentService({
    enabled: deps.enabled && Boolean(gateway),
    model: gateway ? (userId) => createGatewayModel(gateway, userId) : undefined,
    // Composition root: a plugin is added here and nowhere else; `@cuelingo/agent` does not change.
    plugins: [corePlugin, exercisePlugin],
    conversations: wiring.conversations,
    usage: wiring.usage,
    services: {
      lookup: (userId, input) => {
        if (!wiring.lookup) throw new Error('lookup unavailable');
        return wiring.lookup(userId, input);
      },
      listPhrases: (userId, language) => wiring.phrases.list(userId, language),
      savePhrase: (userId, input) => wiring.phrases.save(userId, input),
    },
    quota: deps.quota,
    limits: deps.limits,
    clock: deps.clock,
  });
  return { service, routes: agentRoutes(service) };
}

export type { AgentRepository } from './agent.repository';
export type { AgentService } from './agent.service';
export type { AgentQuotaLimits } from './agent.quota';
export { createPostgresAgentRepository } from './agent.repository';
export { createInMemoryAgentRepository } from './agent.repository.memory';
