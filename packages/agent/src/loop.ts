import type { AgentDoneStatus, AgentStreamEvent, LanguageCode } from '@cuelingo/shared';
import { ErrorCode } from '@cuelingo/shared';
import { buildContext } from './context';
import { DEFAULT_LIMITS, type TurnLimits } from './limits';
import type { ModelMessage, ModelPort, ModelToolCall } from './model';
import type { ToolRegistry } from './plugin';
import { failure, runTool, toDeclaration, type ToolRunResult } from './tools';

export interface TurnHooks {
  /** Asked before every model step; `false` ends the turn as `limited` (the API checks the daily quota here). */
  beforeStep?(step: number): boolean | Promise<boolean>;
  /** Called after every model step with the tokens it used. */
  afterStep?(info: {
    step: number;
    inputTokens?: number;
    outputTokens?: number;
  }): void | Promise<void>;
}

export interface TurnInput<C = unknown> {
  model: ModelPort;
  registry: ToolRegistry<C>;
  /** Earlier messages of the conversation, oldest first, not including `userMessage`. */
  history: ModelMessage[];
  userMessage: string;
  language: LanguageCode;
  /** Passed to tools as `ctx.capabilities`; already bound to the signed-in user. */
  capabilities: C;
  /** Aborting ends the turn as `done{stopped}`. */
  signal?: AbortSignal;
  limits?: Partial<TurnLimits>;
  hooks?: TurnHooks;
  /** Tokens the system prompt will take (the gateway adds it); counted against the context budget. */
  reservedTokens?: number;
}

/**
 * One turn of "think → call tools → answer". Yields the stream events of the turn and always ends with
 * exactly one `done`. A failed model step yields `error{AGENT_FAILED}` and then `done{error}`; abort ends
 * with `done{stopped}`; running out of steps, time or quota ends with `done{limited}`. Never throws.
 */
export async function* runTurn<C>(
  input: TurnInput<C>,
): AsyncGenerator<AgentStreamEvent, void, void> {
  const limits = { ...DEFAULT_LIMITS, ...input.limits };
  const userSignal = input.signal;
  const deadline = AbortSignal.timeout(limits.turnTimeoutMs);
  const signal = AbortSignal.any(userSignal ? [userSignal, deadline] : [deadline]);
  const interrupted = (): AgentDoneStatus => (userSignal?.aborted ? 'stopped' : 'limited');
  const done = (status: AgentDoneStatus): AgentStreamEvent => ({ type: 'done', status });

  if (userSignal?.aborted) {
    yield done('stopped');
    return;
  }

  const messages: ModelMessage[] = [...input.history, { role: 'user', content: input.userMessage }];
  let writeCalls = 0;

  for (let step = 0; step < limits.maxSteps; step += 1) {
    if (signal.aborted) return yield done(interrupted());
    if (input.hooks?.beforeStep && !(await input.hooks.beforeStep(step))) {
      return yield done('limited');
    }

    yield { type: 'status', status: 'thinking' };

    const context = buildContext({
      history: messages,
      budgetTokens: limits.contextBudgetTokens,
      reservedTokens: input.reservedTokens,
    });
    let text = '';
    const calls: ModelToolCall[] = [];
    let usage: { inputTokens?: number; outputTokens?: number } = {};
    try {
      for await (const event of input.model.step({
        language: input.language,
        messages: context.messages,
        tools: input.registry.tools().map((tool) => toDeclaration(tool)),
        signal,
      })) {
        if (signal.aborted) break;
        if (event.type === 'text_delta') {
          if (!event.text) continue;
          text += event.text;
          yield { type: 'text_delta', text: event.text };
        } else if (event.type === 'tool_call') {
          calls.push({ ...event.call, id: `s${step}c${calls.length}` });
        } else {
          usage = { inputTokens: event.inputTokens, outputTokens: event.outputTokens };
        }
      }
    } catch {
      if (signal.aborted) return yield done(interrupted());
      yield { type: 'error', code: ErrorCode.AgentFailed };
      return yield done('error');
    }
    if (signal.aborted) return yield done(interrupted());
    await input.hooks?.afterStep?.({ step, ...usage });

    if (calls.length === 0) return yield done('complete');

    messages.push({ role: 'assistant', content: text, toolCalls: calls });
    for (const call of calls) {
      yield { type: 'tool_call', callId: call.id, tool: call.name };
      const tool = input.registry.get(call.name);
      let result: ToolRunResult;
      if (!tool) result = failure('unknown_tool');
      else if (tool.kind === 'write' && writeCalls >= limits.maxWriteCalls)
        result = failure('limit');
      else {
        if (tool.kind === 'write') writeCalls += 1;
        result = await runTool(
          tool,
          call.input,
          { capabilities: input.capabilities, signal },
          { timeoutMs: limits.toolTimeoutMs },
        );
      }
      if (signal.aborted) return yield done(interrupted());

      messages.push({
        role: 'tool',
        toolCallId: call.id,
        name: call.name,
        content: result.content,
      });
      yield {
        type: 'tool_result',
        callId: call.id,
        tool: call.name,
        ok: result.ok,
        ...(result.ok
          ? result.summary
            ? { summary: result.summary }
            : {}
          : { summary: result.error }),
      };
      if (result.ok && result.card) yield { type: 'card', card: result.card };
    }
  }
  yield done('limited');
}
