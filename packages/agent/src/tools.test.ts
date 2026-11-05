import type { AgentCard } from '@cuelingo/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MAX_TOOL_OUTPUT_BYTES } from './limits';
import {
  cutOutput,
  defineTool,
  runTool,
  toDeclaration,
  TOOL_ERRORS_VI,
  type ToolContext,
} from './tools';

const ctx = (signal = new AbortController().signal): ToolContext<{ prefix: string }> => ({
  capabilities: { prefix: 'p' },
  signal,
});

const echo = defineTool({
  name: 'echo',
  description: 'Echo a word',
  kind: 'read',
  input: z.object({ word: z.string().min(1) }),
  output: z.object({ echoed: z.string() }),
  run: async ({ word }, c: ToolContext<{ prefix: string }>) => ({
    echoed: c.capabilities.prefix + word,
  }),
  summarize: (o) => `Đã tra ${o.echoed}`,
});

describe('runTool', () => {
  it('validates input and output and returns JSON text', async () => {
    const out = await runTool(echo, { word: 'hi' }, ctx());
    expect(out).toMatchObject({ ok: true, output: { echoed: 'phi' }, summary: 'Đã tra phi' });
    expect(out.content).toBe('{"echoed":"phi"}');
  });

  it('fails invalid input without running the tool', async () => {
    let ran = false;
    const tool = defineTool({
      name: 't',
      description: 'd',
      kind: 'read',
      input: z.object({ word: z.string() }),
      output: z.unknown(),
      run: async () => {
        ran = true;
        return null;
      },
    });
    const out = await runTool(tool, { word: 5 }, ctx());
    expect(out).toMatchObject({
      ok: false,
      reason: 'invalid_input',
      error: TOOL_ERRORS_VI.invalid_input,
    });
    expect(ran).toBe(false);
  });

  it('turns a thrown error into a Vietnamese sentence without leaking the message', async () => {
    const tool = defineTool({
      name: 't',
      description: 'd',
      kind: 'read',
      input: z.object({}),
      output: z.unknown(),
      run: async () => {
        throw new Error('select * from secret where user=42');
      },
    });
    const out = await runTool(tool, {}, ctx());
    expect(out).toMatchObject({ ok: false, reason: 'failed' });
    expect(out.content).not.toContain('secret');
    expect(out.content).toContain(TOOL_ERRORS_VI.failed);
  });

  it('times out a slow tool', async () => {
    const tool = defineTool({
      name: 'slow',
      description: 'd',
      kind: 'read',
      input: z.object({}),
      output: z.unknown(),
      run: () => new Promise(() => undefined),
    });
    const out = await runTool(tool, {}, ctx(), { timeoutMs: 20 });
    expect(out).toMatchObject({ ok: false, reason: 'timeout', error: TOOL_ERRORS_VI.timeout });
  });

  it('stops when the turn is aborted', async () => {
    const controller = new AbortController();
    const tool = defineTool({
      name: 'slow',
      description: 'd',
      kind: 'read',
      input: z.object({}),
      output: z.unknown(),
      run: () => new Promise(() => undefined),
    });
    const pending = runTool(tool, {}, ctx(controller.signal), { timeoutMs: 5_000 });
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, reason: 'aborted' });
  });

  it('rejects an output that does not match its schema', async () => {
    const tool = defineTool({
      name: 't',
      description: 'd',
      kind: 'read',
      input: z.object({}),
      output: z.object({ n: z.number() }),
      run: async () => ({ n: 'no' }) as unknown as { n: number },
    });
    expect(await runTool(tool, {}, ctx())).toMatchObject({ ok: false, reason: 'invalid_output' });
  });

  it('cuts a large output to 2 KB', async () => {
    const tool = defineTool({
      name: 'big',
      description: 'd',
      kind: 'read',
      input: z.object({}),
      output: z.object({ items: z.array(z.string()) }),
      run: async () => ({ items: Array.from({ length: 2_000 }, (_, i) => `item ${i}`) }),
    });
    const out = await runTool(tool, {}, ctx());
    expect(out.ok).toBe(true);
    expect(new TextEncoder().encode(out.content).length).toBeLessThanOrEqual(MAX_TOOL_OUTPUT_BYTES);
    expect(JSON.parse(out.content)).toMatchObject({ truncated: true });
  });

  it('attaches a card only when it is valid', async () => {
    const good: AgentCard = { kind: 'phrase_list', data: { items: [{ phrase: 'x' }] } };
    const make = (card: unknown) =>
      defineTool({
        name: 'show',
        description: 'd',
        kind: 'read',
        input: z.object({}),
        output: z.object({}),
        run: async () => ({}),
        toCard: () => card as AgentCard,
      });
    expect(await runTool(make(good), {}, ctx())).toMatchObject({ ok: true, card: good });
    const bad = await runTool(make({ kind: 'html', data: {} }), {}, ctx());
    expect(bad).toMatchObject({ ok: true });
    expect('card' in bad).toBe(false);
  });
});

describe('cutOutput', () => {
  it('leaves small output alone and counts bytes, not characters', () => {
    expect(cutOutput({ a: 1 })).toBe('{"a":1}');
    const vi = cutOutput({ text: 'ệ'.repeat(3_000) }, 500);
    expect(new TextEncoder().encode(vi).length).toBeLessThanOrEqual(500);
  });
});

describe('toDeclaration', () => {
  it('describes the input as JSON Schema', () => {
    const decl = toDeclaration(echo);
    expect(decl.name).toBe('echo');
    expect(decl.inputSchema).toMatchObject({ type: 'object', required: ['word'] });
    expect(decl.inputSchema).not.toHaveProperty('$schema');
  });
});
