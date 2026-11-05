import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createToolRegistry, type AgentPlugin } from './plugin';
import { defineTool } from './tools';

const tool = (name: string) =>
  defineTool({
    name,
    description: name,
    kind: 'read',
    input: z.object({}),
    output: z.object({}),
    run: async () => ({}),
  });

const plugin = (id: string, tools: string[], setup?: AgentPlugin['setup']): AgentPlugin => ({
  id,
  version: '1.0.0',
  permissions: [],
  tools: tools.map(tool),
  setup,
});

describe('createToolRegistry', () => {
  it('exposes the tools of loaded plugins in registration order', async () => {
    const registry = createToolRegistry();
    await registry.register(plugin('a', ['one', 'two']));
    await registry.register(plugin('b', ['three']));
    expect(registry.tools().map((t) => t.name)).toEqual(['one', 'two', 'three']);
    expect(registry.get('two')?.name).toBe('two');
    expect(registry.list()).toEqual([
      { id: 'a', version: '1.0.0', state: 'loaded' },
      { id: 'b', version: '1.0.0', state: 'loaded' },
    ]);
  });

  it('runs setup once with the plugin id', async () => {
    const seen: string[] = [];
    await createToolRegistry().register(
      plugin('a', ['one'], async (host) => {
        seen.push(host.pluginId);
      }),
    );
    expect(seen).toEqual(['a']);
  });

  it('marks a plugin failed when setup throws and keeps the others working', async () => {
    const registry = createToolRegistry();
    const status = await registry.register(
      plugin('bad', ['broken'], async () => {
        throw new Error('boom');
      }),
    );
    await registry.register(plugin('good', ['fine']));
    expect(status.state).toBe('failed');
    expect(registry.tools().map((t) => t.name)).toEqual(['fine']);
    expect(registry.get('broken')).toBeUndefined();
  });

  it('refuses a tool name that is already taken', async () => {
    const registry = createToolRegistry();
    await registry.register(plugin('a', ['same']));
    const status = await registry.register(plugin('b', ['same', 'other']));
    expect(status.state).toBe('failed');
    expect(registry.tools().map((t) => t.name)).toEqual(['same']);
  });

  it('refuses a second plugin with a loaded id without replacing it', async () => {
    const registry = createToolRegistry();
    await registry.register(plugin('a', ['one']));
    expect((await registry.register(plugin('a', ['two']))).state).toBe('failed');
    expect(registry.tools().map((t) => t.name)).toEqual(['one']);
  });

  it('unregisters at run time', async () => {
    const registry = createToolRegistry();
    await registry.register(plugin('a', ['one']));
    expect(registry.unregister('a')).toBe(true);
    expect(registry.tools()).toEqual([]);
    expect(registry.unregister('a')).toBe(false);
  });
});
