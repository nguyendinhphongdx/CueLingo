import type { LanguageCode } from '@cuelingo/shared';

/**
 * The one thing the loop needs from a model: a single streamed step. The API adapts `@cuelingo/ai-gateway`'s
 * `chat()` to this shape; tests pass a fake. Swapping the model never touches context, tools or the loop.
 */

export interface ModelToolCall {
  id: string;
  name: string;
  input: unknown;
}

export type ModelMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ModelToolCall[] }
  /** One tool result; `content` is JSON text. */
  | { role: 'tool'; toolCallId: string; name: string; content: string };

export interface ModelToolDeclaration {
  name: string;
  description: string;
  /** JSON Schema of the tool input. */
  inputSchema: Record<string, unknown>;
}

export type ModelEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call'; call: ModelToolCall }
  | {
      type: 'finish';
      reason: 'stop' | 'tool_calls' | 'length' | 'other';
      inputTokens?: number;
      outputTokens?: number;
    };

export interface ModelStepInput {
  language: LanguageCode;
  messages: ModelMessage[];
  tools: ModelToolDeclaration[];
  signal: AbortSignal;
}

export interface ModelPort {
  /** Streams one step. Throws on provider failure; may end early (without `finish`) when `signal` aborts. */
  step(input: ModelStepInput): AsyncIterable<ModelEvent>;
}
