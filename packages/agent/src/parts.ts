import type { AgentStreamEvent, MessagePart } from '@cuelingo/shared';

/**
 * Folds the events of a turn into the `parts` stored with the assistant message, so what a reopened
 * conversation shows equals what streamed. The API calls `apply` per event and saves `parts()` after each step.
 */
export interface PartsBuilder {
  apply(event: AgentStreamEvent): void;
  parts(): MessagePart[];
}

export function createPartsBuilder(): PartsBuilder {
  const parts: MessagePart[] = [];
  return {
    apply(event) {
      if (event.type === 'text_delta') {
        const last = parts[parts.length - 1];
        if (last?.type === 'text')
          parts[parts.length - 1] = { type: 'text', text: last.text + event.text };
        else parts.push({ type: 'text', text: event.text });
      } else if (event.type === 'tool_call') {
        parts.push({
          type: 'tool_step',
          callId: event.callId,
          tool: event.tool,
          status: 'running',
        });
      } else if (event.type === 'tool_result') {
        const index = parts.findIndex((p) => p.type === 'tool_step' && p.callId === event.callId);
        if (index >= 0) {
          parts[index] = {
            type: 'tool_step',
            callId: event.callId,
            tool: event.tool,
            status: event.ok ? 'ok' : 'error',
            ...(event.summary ? { summary: event.summary } : {}),
          };
        }
      } else if (event.type === 'card') {
        parts.push({ type: 'card', card: event.card });
      }
    },
    parts: () => parts.map((p) => ({ ...p })),
  };
}
