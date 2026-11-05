import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { jsonSchema, streamText, tool, type ModelMessage } from 'ai';

/**
 * One streamed model step with tool declarations (task `agent.chat`, ADR 0018). The gateway never runs a
 * tool: it reports the calls the model asked for and the caller (`@cuelingo/agent`) decides what happens next.
 */

export interface ChatToolCall {
  id: string;
  name: string;
  input: unknown;
}

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ChatToolCall[] }
  /** The result of one tool call; `content` is JSON text and the gateway wraps it as data (`<tool_result>`). */
  | { role: 'tool'; toolCallId: string; name: string; content: string };

export interface ChatToolDeclaration {
  name: string;
  description: string;
  /** JSON Schema of the tool input (an object schema). */
  inputSchema: Record<string, unknown>;
}

export type ChatFinishReason = 'stop' | 'tool_calls' | 'length' | 'other';

export type ChatStreamPart =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call'; call: ChatToolCall }
  | { type: 'finish'; reason: ChatFinishReason; inputTokens?: number; outputTokens?: number };

export interface StreamChatArgs {
  model: string;
  system: string;
  messages: ChatMessage[];
  tools: ChatToolDeclaration[];
  maxOutputTokens: number;
  signal: AbortSignal;
}

/** Test seam: replaces the provider call. Throws on provider failure; ends with a `finish` part. */
export type StreamChatFn = (args: StreamChatArgs) => AsyncIterable<ChatStreamPart>;

/** Tool output is data, never instructions: the system prompt names this delimiter (`agent.chat@v1`). */
export const wrapToolResult = (content: string): string =>
  `<tool_result>\n${content.replaceAll('</tool_result>', '< /tool_result>')}\n</tool_result>`;

export function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages.map((message): ModelMessage => {
    if (message.role === 'user') return { role: 'user', content: message.content };
    if (message.role === 'assistant') {
      const calls = message.toolCalls ?? [];
      if (calls.length === 0) return { role: 'assistant', content: message.content };
      return {
        role: 'assistant',
        content: [
          ...(message.content ? [{ type: 'text' as const, text: message.content }] : []),
          ...calls.map((call) => ({
            type: 'tool-call' as const,
            toolCallId: call.id,
            toolName: call.name,
            input: call.input,
          })),
        ],
      };
    }
    return {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: message.toolCallId,
          toolName: message.name,
          output: { type: 'text', value: wrapToolResult(message.content) },
        },
      ],
    };
  });
}

const FINISH: Record<string, ChatFinishReason> = {
  stop: 'stop',
  'tool-calls': 'tool_calls',
  length: 'length',
};

export function createGeminiStreamChat(apiKey: string): StreamChatFn {
  const google = createGoogleGenerativeAI({ apiKey });
  return async function* ({ model, system, messages, tools, maxOutputTokens, signal }) {
    const result = streamText({
      model: google(model),
      system,
      messages: toModelMessages(messages),
      // No `execute`: the SDK reports the call and stops after this one step.
      tools: Object.fromEntries(
        tools.map((t) => [
          t.name,
          tool({ description: t.description, inputSchema: jsonSchema(t.inputSchema) }),
        ]),
      ),
      maxOutputTokens,
      abortSignal: signal,
      providerOptions: { google: { thinkingConfig: { thinkingLevel: 'minimal' } } },
    });
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        yield { type: 'text_delta', text: part.text };
      } else if (part.type === 'tool-call') {
        yield {
          type: 'tool_call',
          call: { id: part.toolCallId, name: part.toolName, input: part.input },
        };
      } else if (part.type === 'finish') {
        yield {
          type: 'finish',
          reason: FINISH[part.finishReason] ?? 'other',
          inputTokens: part.totalUsage.inputTokens,
          outputTokens: part.totalUsage.outputTokens,
        };
      } else if (part.type === 'error') {
        throw part.error instanceof Error ? part.error : new Error('model stream error');
      } else if (part.type === 'abort') {
        throw new Error('aborted');
      }
    }
  };
}
