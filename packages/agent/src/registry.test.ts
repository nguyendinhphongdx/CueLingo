import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runTurn } from './loop';
import type { AgentPlugin } from './plugin';
import { createToolRegistry } from './registry';
import { call, finish, scriptedModel, text } from './test-helpers';
import { defineTool, type AgentPermission, type AgentTool, type ToolContext } from './tools';

const tool = (name: string, run: AgentTool['run'] = async () => ({})): AgentTool =>
  defineTool({
    name,
    description: name,
    kind: 'read',
    input: z.object({}),
    output: z.object({}),
    run,
  });

const plugin = (
  id: string,
  tools: Array<string | AgentTool>,
  extra: Partial<AgentPlugin> = {},
): AgentPlugin => ({
  id,
  version: '1.0.0',
  permissions: [],
  tools: tools.map((t) => (typeof t === 'string' ? tool(t) : t)),
  ...extra,
});

const names = (registry: { tools(): AgentTool[] }) => registry.tools().map((t) => t.name);
const ctx = (capabilities: unknown = {}): ToolContext => ({
  capabilities,
  signal: new AbortController().signal,
});
const boom = async (): Promise<never> => {
  throw new Error('secret internal detail');
};

describe('createToolRegistry', () => {
  it('exposes the tools of loaded plugins in registration order', async () => {
    const registry = createToolRegistry();
    await registry.register(plugin('a', ['one', 'two'], { permissions: ['lookup'] }));
    await registry.register(plugin('b', ['three']));
    expect(names(registry)).toEqual(['one', 'two', 'three']);
    expect(registry.get('two')?.name).toBe('two');
    expect(registry.list()).toEqual([
      {
        id: 'a',
        version: '1.0.0',
        state: 'loaded',
        permissions: ['lookup'],
        tools: ['one', 'two'],
      },
      { id: 'b', version: '1.0.0', state: 'loaded', permissions: [], tools: ['three'] },
    ]);
  });

  it('runs setup once with the plugin id', async () => {
    const seen: string[] = [];
    await createToolRegistry().register(
      plugin('a', ['one'], {
        setup: async (host) => {
          seen.push(host.pluginId);
        },
      }),
    );
    expect(seen).toEqual(['a']);
  });

  it('refuses a tool name that is already taken', async () => {
    const registry = createToolRegistry();
    await registry.register(plugin('a', ['same']));
    const status = await registry.register(plugin('b', ['same', 'other']));
    expect(status.state).toBe('failed');
    expect(names(registry)).toEqual(['same']);
  });

  it('refuses a second plugin with a loaded id without replacing it', async () => {
    const registry = createToolRegistry();
    await registry.register(plugin('a', ['one']));
    expect((await registry.register(plugin('a', ['two']))).state).toBe('failed');
    expect(names(registry)).toEqual(['one']);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]?.state).toBe('loaded');
  });

  it('lets a failed plugin id be registered again', async () => {
    const registry = createToolRegistry();
    await registry.register(plugin('a', ['one'], { setup: boom }));
    expect((await registry.register(plugin('a', ['one']))).state).toBe('loaded');
    expect(names(registry)).toEqual(['one']);
  });
});

describe('AC16: plugins change at run time without touching the core', () => {
  it('register and unregister change the tool list the model gets', async () => {
    const registry = createToolRegistry();
    const model = scriptedModel([
      [text('a'), finish],
      [text('b'), finish],
      [text('c'), finish],
    ]);
    const turn = async () => {
      for await (const _event of runTurn({
        model,
        registry,
        history: [],
        userMessage: 'hi',
        language: 'en',
        capabilities: {},
      })) {
        // drain
      }
    };

    await registry.register(plugin('core', ['lookup']));
    await turn();
    await registry.register(plugin('extra', ['make']));
    await turn();
    expect(registry.unregister('extra')).toBe(true);
    await turn();

    expect(model.inputs.map((i) => i.tools.map((t) => t.name))).toEqual([
      ['lookup'],
      ['lookup', 'make'],
      ['lookup'],
    ]);
    expect(registry.unregister('extra')).toBe(false);
  });

  it('enable and disable hide and show the tools of one plugin only', async () => {
    const registry = createToolRegistry();
    await registry.register(plugin('a', ['one']));
    await registry.register(plugin('b', ['two']));
    expect(registry.disable('a')?.state).toBe('disabled');
    expect(registry.disable('a')?.disabledBy).toBe('admin');
    expect(names(registry)).toEqual(['two']);
    expect(registry.get('one')).toBeUndefined();
    expect((await registry.execute('one', {}, ctx())).ok).toBe(false);
    expect(registry.enable('a')?.state).toBe('loaded');
    expect(names(registry)).toEqual(['one', 'two']);
    expect(registry.enable('nope')).toBeUndefined();
    expect(registry.disable('nope')).toBeUndefined();
  });

  it('does not let enable revive a plugin whose setup failed', async () => {
    const registry = createToolRegistry();
    await registry.register(plugin('bad', ['x'], { setup: boom }));
    expect(registry.enable('bad')?.state).toBe('failed');
    expect(names(registry)).toEqual([]);
  });
});

describe('AC17: a broken plugin does not take the others down', () => {
  it('marks a plugin failed when setup throws and keeps the others working', async () => {
    const registry = createToolRegistry();
    const status = await registry.register(plugin('bad', ['broken'], { setup: boom }));
    await registry.register(plugin('good', ['fine']));
    expect(status.state).toBe('failed');
    expect(names(registry)).toEqual(['fine']);
    expect(registry.get('broken')).toBeUndefined();
    expect((await registry.execute('fine', {}, ctx())).ok).toBe(true);
  });

  it('answers with a Vietnamese sentence, not the original error, when a tool throws', async () => {
    const registry = createToolRegistry();
    await registry.register(plugin('a', [tool('flaky', boom)]));
    const result = await registry.execute('flaky', {}, ctx());
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('the agent still answers when a plugin tool fails', async () => {
    const registry = createToolRegistry();
    await registry.register(plugin('a', [tool('flaky', boom)]));
    const model = scriptedModel([
      [call('flaky'), finish],
      [text('Xin lỗi, mình thử cách khác.'), finish],
    ]);
    const events = [];
    for await (const event of runTurn({
      model,
      registry,
      history: [],
      userMessage: 'hi',
      language: 'en',
      capabilities: {},
    })) {
      events.push(event);
    }
    expect(events.find((e) => e.type === 'tool_result')).toMatchObject({ ok: false });
    expect(events.at(-1)).toEqual({ type: 'done', status: 'complete' });
  });
});

describe('permission facade', () => {
  const scope = (caps: Record<string, unknown>, granted: readonly AgentPermission[]) =>
    Object.fromEntries(
      Object.entries(caps).filter(([key]) => granted.includes(key as AgentPermission)),
    );

  it('gives a tool only the capabilities its plugin declared', async () => {
    const seen: unknown[] = [];
    const spy = tool('spy', async (_input, c) => {
      seen.push(Object.keys(c.capabilities as object));
      return {};
    });
    const registry = createToolRegistry<Record<string, unknown>>({ scope });
    await registry.register(
      plugin('a', [spy], { permissions: ['lookup'] }) as AgentPlugin<Record<string, unknown>>,
    );
    await registry.execute(
      'spy',
      {},
      ctx({ lookup: 1, 'phrases:write': 2, html: 3 }) as ToolContext<Record<string, unknown>>,
    );
    expect(seen).toEqual([['lookup']]);
  });
});

describe('AC17: circuit breaker', () => {
  const setup = async () => {
    let time = 1_000;
    const registry = createToolRegistry({ clock: () => time });
    let broken = true;
    await registry.register(
      plugin('a', [
        tool('flaky', async () => {
          if (broken) throw new Error('x');
          return {};
        }),
        tool('other'),
      ]),
    );
    await registry.register(plugin('b', ['fine']));
    return {
      registry,
      advance: (ms: number) => (time += ms),
      fix: () => (broken = false),
    };
  };

  it('turns the plugin off for 10 minutes after 3 failures in a row, the others keep working', async () => {
    const { registry } = await setup();
    await registry.execute('flaky', {}, ctx());
    await registry.execute('flaky', {}, ctx());
    expect(registry.list()[0]?.state).toBe('loaded');
    await registry.execute('flaky', {}, ctx());
    const status = registry.list()[0]!;
    expect(status).toMatchObject({ state: 'disabled', disabledBy: 'breaker' });
    expect(status.retryAt).toBe(new Date(1_000 + 10 * 60_000).toISOString());
    expect(names(registry)).toEqual(['fine']);
    expect((await registry.execute('fine', {}, ctx())).ok).toBe(true);
  });

  it('a success resets the count of that tool', async () => {
    const { registry, fix } = await setup();
    await registry.execute('flaky', {}, ctx());
    await registry.execute('flaky', {}, ctx());
    fix();
    expect((await registry.execute('flaky', {}, ctx())).ok).toBe(true);
    for (let i = 0; i < 2; i += 1) await registry.execute('fine', {}, ctx());
    expect(registry.list()[0]?.state).toBe('loaded');
  });

  it('does not count bad input or stops against the plugin', async () => {
    const registry = createToolRegistry();
    await registry.register(plugin('a', ['one']));
    const strict = defineTool({
      name: 'strict',
      description: 's',
      kind: 'read',
      input: z.object({ n: z.number() }),
      output: z.object({}),
      run: async () => ({}),
    });
    await registry.register(plugin('s', [strict]));
    for (let i = 0; i < 5; i += 1) await registry.execute('strict', { n: 'x' }, ctx());
    expect(registry.list().map((p) => p.state)).toEqual(['loaded', 'loaded']);
  });

  it('half-open: after the cooldown one trial decides', async () => {
    const { registry, advance, fix } = await setup();
    for (let i = 0; i < 3; i += 1) await registry.execute('flaky', {}, ctx());
    advance(10 * 60_000 - 1);
    expect(registry.list()[0]?.state).toBe('disabled');
    advance(1);
    expect(names(registry)).toEqual(['flaky', 'other', 'fine']);

    // A failed trial opens the breaker again at once.
    await registry.execute('flaky', {}, ctx());
    expect(registry.list()[0]?.state).toBe('disabled');

    // A successful trial closes it.
    advance(10 * 60_000);
    fix();
    expect((await registry.execute('flaky', {}, ctx())).ok).toBe(true);
    expect(registry.list()[0]).toMatchObject({ state: 'loaded' });
    expect(registry.list()[0]?.retryAt).toBeUndefined();
  });

  it('an admin enable clears the breaker', async () => {
    const { registry } = await setup();
    for (let i = 0; i < 3; i += 1) await registry.execute('flaky', {}, ctx());
    expect(registry.enable('a')?.state).toBe('loaded');
  });
});
