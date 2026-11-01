import type { AiGateway } from '@cuelingo/ai-gateway';
import { ComposeOutputSchema, LookupOutputSchema, RecapOutputSchema } from '@cuelingo/prompts';
import {
  ErrorCode,
  type ComposeRequest,
  type ComposeResponse,
  type LookupRequest,
  type LookupResponse,
  type RecapRequest,
  type RecapResponse,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';

export interface AssistDeps {
  gateway: Pick<AiGateway, 'json'>;
}

export type AssistService = ReturnType<typeof createAssistService>;

/** Quick Assist business operations. Inputs and AI outputs both use the shared contract. */
export function createAssistService({ gateway }: AssistDeps) {
  async function execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch {
      throw new AppError(ErrorCode.AssistFailed, 'Quick Assist is temporarily unavailable');
    }
  }

  return {
    lookup(input: LookupRequest): Promise<LookupResponse> {
      return execute(() => gateway.json('assist.lookup', input, LookupOutputSchema));
    },

    recap(input: RecapRequest): Promise<RecapResponse> {
      return execute(() => gateway.json('assist.recap', input, RecapOutputSchema));
    },

    compose(input: ComposeRequest): Promise<ComposeResponse> {
      return execute(() => gateway.json('assist.compose', input, ComposeOutputSchema));
    },
  };
}
