import { type AgentStreamEvent } from '@cuelingo/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runTurn, type TurnInput } from './loop';
import type { ModelEvent, ModelPort } from './model';
import { createToolRegistry } from './plugin';
import { call, finish, scriptedModel, text } from './test-helpers';
import { defineTool, TOOL_ERRORS_VI, type AgentTool } from './tools';

const lookup = defineTool({
  name: 'lookup_word',
  description: 'Look a word up',
  kind: 'read',
  input: z.object({ term: z.string() }),
  output: z.object({ meaningVi: z.string() }),
  run: async ({ term }) => ({ meaningVi: `nghĩa của ${term}` }),
  summarize: (o) => o.meaningVi,
});

const save = defineTool({
  name: 'save_phrase',
  description: 'Save a phrase',
  kind: 'write',
  input: z.object({ phrase: z.string() }),
  output: z.object({ saved: z.boolean() }),
  run: async () => ({ saved: true }),
});

const show = defineTool({
  name: 'show_card',
  description: 'Show a card',
  kind: 'read',
  input: z.object({ phrase: z.string() }),
  output: z.object({ phrase: z.string() }),
  run: async (input) => input,
  toCard: (o) => ({ kind: 'phrase_list', data: { items: [{ phrase: o.phrase }] } }),
});

const broken = defineTool({
  name: 'broken',
  description: 'Always fails',
  kind: 'read',
  input: z.object({}),
  output: z.object({}),
  run: async () => {
    throw new Error('db down');
  },
});

async function registryOf(...tools: AgentTool[]) {
  const registry = createToolRegistry();
  await registry.register({ id: 'test', version: '1', permissions: [], tools });
  return registry;
}

async function run(
  model: ModelPort,
  tools: AgentTool[] = [lookup, save, show, broken],
  extra: Partial<TurnInput> = {},
) {
  const events: AgentStreamEvent[] = [];
  const turn = runTurn({
    model,
    registry: await registryOf(...tools),
    history: [],
    userMessage: 'hello',
    language: 'en',
    capabilities: {},
    ...extra,
  });
  for await (const event of turn) events.push(event);
  return events;
}

const types = (events: AgentStreamEvent[]) => events.map((e) => e.type);
const doneOf = (events: AgentStreamEvent[]) => events.filter((e) => e.type === 'done');

describe('runTurn: answer', () => {
  it('says thinking before the first text and finishes with done complete', async () => {
    const events = await run(scriptedModel([[text('Hel'), text('lo'), finish]]));
    expect(types(events)).toEqual(['status', 'text_delta', 'text_delta', 'done']);
    expect(events[0]).toEqual({ type: 'status', status: 'thinking' });
    expect(events.at(-1)).toEqual({ type: 'done', status: 'complete' });
  });

  it('sends the history and the new user message to the model, with the tool declarations', async () => {
    const model = scriptedModel([[text('ok'), finish]]);
    await run(model, [lookup], {
      history: [
        { role: 'user', content: 'earlier question' },
        { role: 'assistant', content: 'earlier answer' },
      ],
      userMessage: 'follow up',
      language: 'ja',
    });
    const input = model.inputs[0]!;
    expect(input.language).toBe('ja');
    expect(input.messages.map((m) => m.content)).toEqual([
      'earlier question',
      'earlier answer',
      'follow up',
    ]);
    expect(input.tools.map((t) => t.name)).toEqual(['lookup_word']);
  });
});

describe('runTurn: tools', () => {
  it('shows the call and result, then gives the result to the next step', async () => {
    const model = scriptedModel([
      [call('lookup_word', { term: 'sync' }), { ...finish, reason: 'tool_calls' }],
      [text('Nghĩa là đồng bộ.'), finish],
    ]);
    const events = await run(model);
    expect(events).toEqual([
      { type: 'status', status: 'thinking' },
      { type: 'tool_call', callId: 's0c0', tool: 'lookup_word' },
      {
        type: 'tool_result',
        callId: 's0c0',
        tool: 'lookup_word',
        ok: true,
        summary: 'nghĩa của sync',
      },
      { type: 'status', status: 'thinking' },
      { type: 'text_delta', text: 'Nghĩa là đồng bộ.' },
      { type: 'done', status: 'complete' },
    ]);
    const second = model.inputs[1]!.messages;
    expect(second.at(-2)).toMatchObject({
      role: 'assistant',
      toolCalls: [{ id: 's0c0', name: 'lookup_word', input: { term: 'sync' } }],
    });
    expect(second.at(-1)).toEqual({
      role: 'tool',
      toolCallId: 's0c0',
      name: 'lookup_word',
      content: '{"meaningVi":"nghĩa của sync"}',
    });
  });

  it('emits a card event for a tool that presents one', async () => {
    const events = await run(
      scriptedModel([
        [call('show_card', { phrase: 'circle back' }), finish],
        [text('Xem thẻ'), finish],
      ]),
    );
    expect(events).toContainEqual({
      type: 'card',
      card: { kind: 'phrase_list', data: { items: [{ phrase: 'circle back' }] } },
    });
  });

  it('turns a failing tool into ok:false with a Vietnamese sentence and still answers', async () => {
    const events = await run(
      scriptedModel([
        [call('broken'), finish],
        [text('Xin lỗi, mình trả lời không cần công cụ.'), finish],
      ]),
    );
    expect(events).toContainEqual({
      type: 'tool_result',
      callId: 's0c0',
      tool: 'broken',
      ok: false,
      summary: TOOL_ERRORS_VI.failed,
    });
    expect(JSON.stringify(events)).not.toContain('db down');
    expect(events.at(-1)).toEqual({ type: 'done', status: 'complete' });
  });

  it('fails a tool that runs too long', async () => {
    const slow = defineTool({
      name: 'slow',
      description: 'd',
      kind: 'read',
      input: z.object({}),
      output: z.object({}),
      run: () => new Promise(() => undefined),
    });
    const events = await run(
      scriptedModel([
        [call('slow'), finish],
        [text('ok'), finish],
      ]),
      [slow],
      {
        limits: { toolTimeoutMs: 20 },
      },
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'tool_result', ok: false, summary: TOOL_ERRORS_VI.timeout }),
    );
    expect(events.at(-1)).toEqual({ type: 'done', status: 'complete' });
  });

  it('fails an unknown tool and an invalid input without stopping the turn', async () => {
    const events = await run(
      scriptedModel([
        [call('nope'), call('lookup_word', { term: 5 }), finish],
        [text('ok'), finish],
      ]),
    );
    const results = events.filter((e) => e.type === 'tool_result');
    expect(results.map((r) => r.summary)).toEqual([
      TOOL_ERRORS_VI.unknown_tool,
      TOOL_ERRORS_VI.invalid_input,
    ]);
    expect(events.at(-1)).toEqual({ type: 'done', status: 'complete' });
  });

  it('runs at most 3 write calls in a turn', async () => {
    const saves = Array.from({ length: 5 }, (_, i) => call('save_phrase', { phrase: `p${i}` }));
    const events = await run(
      scriptedModel([
        [...saves, finish],
        [text('ok'), finish],
      ]),
    );
    const results = events.filter((e) => e.type === 'tool_result');
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false, false]);
    expect(results[4]!.summary).toBe(TOOL_ERRORS_VI.limit);
  });
});

describe('runTurn: limits and failures', () => {
  it('ends as limited after 6 model steps', async () => {
    const model = scriptedModel(
      Array.from({ length: 10 }, () => [call('lookup_word', { term: 'x' }), finish]),
    );
    const events = await run(model);
    expect(model.inputs).toHaveLength(6);
    expect(events.at(-1)).toEqual({ type: 'done', status: 'limited' });
    expect(doneOf(events)).toHaveLength(1);
  });

  it('ends as limited when the hook refuses a step (quota)', async () => {
    const model = scriptedModel([
      [call('lookup_word', { term: 'x' }), finish],
      [text('no'), finish],
    ]);
    const events = await run(model, undefined, { hooks: { beforeStep: (step) => step === 0 } });
    expect(model.inputs).toHaveLength(1);
    expect(events.at(-1)).toEqual({ type: 'done', status: 'limited' });
  });

  it('reports the tokens of every step to the hook', async () => {
    const seen: unknown[] = [];
    await run(scriptedModel([[text('a'), finish]]), undefined, {
      hooks: { afterStep: (info) => void seen.push(info) },
    });
    expect(seen).toEqual([{ step: 0, inputTokens: 10, outputTokens: 5 }]);
  });

  it('ends as limited when the turn runs out of time', async () => {
    const hanging: ModelPort = {
      step: ({ signal }) =>
        (async function* (): AsyncGenerator<ModelEvent> {
          yield { type: 'text_delta', text: 'start' };
          await new Promise((resolve) => signal.addEventListener('abort', resolve));
        })(),
    };
    const events = await run(hanging, undefined, { limits: { turnTimeoutMs: 30 } });
    expect(events.at(-1)).toEqual({ type: 'done', status: 'limited' });
  });

  it('reports AGENT_FAILED then done error when the model fails', async () => {
    const events = await run(scriptedModel([new Error('provider said: secret detail')]));
    expect(events).toEqual([
      { type: 'status', status: 'thinking' },
      { type: 'error', code: 'AGENT_FAILED' },
      { type: 'done', status: 'error' },
    ]);
  });

  it('keeps the text already streamed when the model fails half way', async () => {
    const model: ModelPort = {
      step: () =>
        (async function* (): AsyncGenerator<ModelEvent> {
          yield { type: 'text_delta', text: 'partial' };
          throw new Error('reset');
        })(),
    };
    const events = await run(model);
    expect(types(events)).toEqual(['status', 'text_delta', 'error', 'done']);
  });
});

describe('runTurn: abort', () => {
  it('ends with done stopped when aborted while the model streams', async () => {
    const controller = new AbortController();
    const model: ModelPort = {
      step: ({ signal }) =>
        (async function* (): AsyncGenerator<ModelEvent> {
          yield { type: 'text_delta', text: 'one ' };
          controller.abort();
          yield { type: 'text_delta', text: 'ignored' };
          await new Promise((resolve) => signal.addEventListener('abort', resolve));
        })(),
    };
    const events = await run(model, undefined, { signal: controller.signal });
    expect(events).toEqual([
      { type: 'status', status: 'thinking' },
      { type: 'text_delta', text: 'one ' },
      { type: 'done', status: 'stopped' },
    ]);
  });

  it('ends with done stopped when aborted during a tool', async () => {
    const controller = new AbortController();
    const slow = defineTool({
      name: 'slow',
      description: 'd',
      kind: 'read',
      input: z.object({}),
      output: z.object({}),
      run: () => {
        controller.abort();
        return new Promise(() => undefined);
      },
    });
    const model = scriptedModel([
      [call('slow'), finish],
      [text('never'), finish],
    ]);
    const events = await run(model, [slow], { signal: controller.signal });
    expect(events.at(-1)).toEqual({ type: 'done', status: 'stopped' });
    expect(model.inputs).toHaveLength(1);
  });

  it('does not call the model when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const model = scriptedModel([[text('x'), finish]]);
    const events = await run(model, undefined, { signal: controller.signal });
    expect(events).toEqual([{ type: 'done', status: 'stopped' }]);
    expect(model.inputs).toHaveLength(0);
  });
});

describe('runTurn: swapping the model', () => {
  it('works the same with any ModelPort', async () => {
    const other: ModelPort = {
      step: () =>
        (async function* (): AsyncGenerator<ModelEvent> {
          yield { type: 'text_delta', text: 'from another model' };
          yield { type: 'finish', reason: 'stop' };
        })(),
    };
    const events = await run(other);
    expect(types(events)).toEqual(['status', 'text_delta', 'done']);
  });
});
