import type { AgentCardKind } from '@cuelingo/shared';
import type { AgentPermission, AgentTool } from './tools';

/**
 * A plugin bundles tools, the card kinds it shows and the permissions it needs, behind one interface (ADR 0018).
 * Shaped so it can later run outside the process (MCP-like: tools described by schemas).
 */
export interface PluginHost {
  /** The plugin's own id; a plugin never learns about the others. */
  pluginId: string;
}

export interface AgentPlugin<C = unknown> {
  id: string;
  version: string;
  permissions: AgentPermission[];
  tools: AgentTool<C>[];
  cardKinds?: AgentCardKind[];
  /** Runs once on `register`; if it throws or rejects the plugin is `failed` and its tools stay hidden. */
  setup?(host: PluginHost): Promise<void>;
}

export type PluginState = 'loaded' | 'failed';

export interface PluginStatus {
  id: string;
  version: string;
  state: PluginState;
}

export interface ToolRegistry<C = unknown> {
  /** Loads a plugin. Never throws: a broken plugin becomes `failed` and the others keep working. */
  register(plugin: AgentPlugin<C>): Promise<PluginStatus>;
  unregister(id: string): boolean;
  /** Tools of the loaded plugins, in registration order; this is what the model is told about. */
  tools(): AgentTool<C>[];
  get(name: string): AgentTool<C> | undefined;
  list(): PluginStatus[];
}

export function createToolRegistry<C = unknown>(): ToolRegistry<C> {
  const plugins = new Map<string, { plugin: AgentPlugin<C>; state: PluginState }>();

  const status = (id: string): PluginStatus => {
    const entry = plugins.get(id)!;
    return { id, version: entry.plugin.version, state: entry.state };
  };

  const takenNames = () =>
    new Set(
      [...plugins.values()]
        .filter((e) => e.state === 'loaded')
        .flatMap((e) => e.plugin.tools.map((t) => t.name)),
    );

  const tools = () =>
    [...plugins.values()].filter((e) => e.state === 'loaded').flatMap((e) => e.plugin.tools);

  return {
    async register(plugin) {
      // Registering an id that is already loaded is refused and leaves the loaded plugin untouched.
      if (plugins.get(plugin.id)?.state === 'loaded') {
        return { id: plugin.id, version: plugin.version, state: 'failed' };
      }
      const names = plugin.tools.map((t) => t.name);
      const taken = takenNames();
      const clash = new Set(names).size !== names.length || names.some((n) => taken.has(n));
      let state: PluginState = clash ? 'failed' : 'loaded';
      if (!clash) {
        try {
          await plugin.setup?.({ pluginId: plugin.id });
        } catch {
          state = 'failed';
        }
      }
      plugins.set(plugin.id, { plugin, state });
      return status(plugin.id);
    },

    unregister: (id) => plugins.delete(id),

    tools,

    get: (name) => tools().find((t) => t.name === name),

    list: () => [...plugins.keys()].map(status),
  };
}
