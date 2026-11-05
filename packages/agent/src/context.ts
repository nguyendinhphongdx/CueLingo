import type { ModelMessage } from './model';

/**
 * Trims the conversation to a token budget with a fixed rule, so the same input always gives the same output:
 *
 * 1. Messages are grouped into turns; a turn starts at a user message and holds everything up to the next one.
 * 2. The oldest whole turns are dropped until the rest fits. The last turn is always kept, even over budget,
 *    and a turn is never cut in the middle, so a tool call and its result stay together.
 * 3. A tool call without a result (or a result without a call) is removed, never sent to the model.
 *
 * The system prompt is added by the gateway, so callers pass its size as `reservedTokens`.
 */

export interface ContextOptions {
  history: ModelMessage[];
  budgetTokens: number;
  reservedTokens?: number;
}

export interface BuiltContext {
  messages: ModelMessage[];
  droppedTurns: number;
  estimatedTokens: number;
}

/** About 4 characters per token; deliberately simple and stable, not a tokenizer. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export function estimateMessageTokens(message: ModelMessage): number {
  const calls =
    message.role === 'assistant' && message.toolCalls
      ? message.toolCalls.reduce(
          (sum, c) =>
            sum + estimateTokens(c.name) + estimateTokens(JSON.stringify(c.input ?? null)),
          0,
        )
      : 0;
  return estimateTokens(message.content) + calls + 4;
}

function splitTurns(messages: ModelMessage[]): ModelMessage[][] {
  const turns: ModelMessage[][] = [];
  for (const message of messages) {
    if (message.role === 'user' || turns.length === 0) turns.push([message]);
    else turns[turns.length - 1]!.push(message);
  }
  return turns;
}

/** Keeps only complete call/result pairs. */
function repairPairs(messages: ModelMessage[]): ModelMessage[] {
  const called = new Set<string>();
  const answered = new Set<string>();
  for (const m of messages) {
    if (m.role === 'assistant') m.toolCalls?.forEach((c) => called.add(c.id));
    if (m.role === 'tool') answered.add(m.toolCallId);
  }
  const out: ModelMessage[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      if (called.has(m.toolCallId)) out.push(m);
    } else if (m.role === 'assistant' && m.toolCalls) {
      const calls = m.toolCalls.filter((c) => answered.has(c.id));
      if (calls.length > 0) out.push({ ...m, toolCalls: calls });
      else if (m.content) out.push({ role: 'assistant', content: m.content });
    } else {
      out.push(m);
    }
  }
  return out;
}

export function buildContext({
  history,
  budgetTokens,
  reservedTokens = 0,
}: ContextOptions): BuiltContext {
  const turns = splitTurns(repairPairs(history));
  const cost = (turn: ModelMessage[]) => turn.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
  const available = Math.max(0, budgetTokens - reservedTokens);

  let total = turns.reduce((sum, turn) => sum + cost(turn), 0);
  let dropped = 0;
  while (dropped < turns.length - 1 && total > available) {
    total -= cost(turns[dropped]!);
    dropped += 1;
  }
  const kept = turns.slice(dropped).flat();
  return { messages: kept, droppedTurns: dropped, estimatedTokens: total + reservedTokens };
}
