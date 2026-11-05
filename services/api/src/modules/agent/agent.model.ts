import type { AiGateway } from '@cuelingo/ai-gateway';
import type { ModelPort } from '@cuelingo/agent';

/**
 * Adapts the gateway's streamed `chat()` to the harness's `ModelPort`. The shapes already match, so this is
 * pass-through; the one thing it adds is the user, so the gateway hook records each step as that user's
 * `ai_call` (`lib/ai-calls.ts`). Swapping the model never touches the harness.
 */
export function createGatewayModel(gateway: Pick<AiGateway, 'chat'>, userId: string): ModelPort {
  return {
    step: ({ language, messages, tools, signal }) =>
      gateway.chat({ language, messages, tools, signal }, { userId }),
  };
}
