import { BREAKER } from './limits';
import type { AgentPlugin, PluginDisabledBy, PluginState, PluginStatus } from './plugin';
import {
  failure,
  runTool,
  type AgentPermission,
  type AgentTool,
  type RunToolOptions,
  type ToolContext,
  type ToolFailure,
  type ToolRunResult,
} from './tools';

export interface ToolRegistry<C = unknown> {
  /** Loads a plugin. Never throws: a broken plugin becomes `failed` and the others keep working. */
  register(plugin: AgentPlugin<C>): Promise<PluginStatus>;
  unregister(id: string): boolean;
  /** Admin switch on. Clears the breaker. A `failed` plugin stays failed. `undefined` if the id is unknown. */
  enable(id: string): PluginStatus | undefined;
  /** Admin switch off; the plugin's tools are hidden from the model until `enable`. */
  disable(id: string): PluginStatus | undefined;
  /** Tools of the enabled, loaded plugins in registration order; this is what the model is told about. */
  tools(): AgentTool<C>[];
  get(name: string): AgentTool<C> | undefined;
  /** Every plugin whatever its state, for the admin screen. */
  list(): PluginStatus[];
  /**
   * Runs a tool as `runTool` does, with `ctx.capabilities` narrowed to what the owning plugin declared in
   * `permissions`, and feeds the outcome to the plugin's circuit breaker. Never throws.
   */
  execute(
    name: string,
    input: unknown,
    ctx: ToolContext<C>,
    options?: RunToolOptions,
  ): Promise<ToolRunResult>;
}

export interface ToolRegistryOptions<C> {
  /** Narrows the turn's capabilities to the declared permissions; without it they pass through unchanged. */
  scope?(capabilities: C, permissions: readonly AgentPermission[]): C;
  clock?(): number;
  breaker?: { failureThreshold: number; cooldownMs: number };
}

/** Failures that say the plugin is unhealthy; a bad input from the model or a user stop is not one. */
const COUNTED: ReadonlySet<ToolFailure> = new Set(['failed', 'timeout', 'invalid_output']);

interface Entry<C> {
  plugin: AgentPlugin<C>;
  /** False when `setup` threw or the plugin clashed with another one. */
  loaded: boolean;
  byAdmin: boolean;
  /** Breaker open until this time; once it has passed the plugin is half-open (next call is a trial). */
  openUntil?: number;
  failures: Map<string, number>;
}

export function createToolRegistry<C = unknown>(
  options: ToolRegistryOptions<C> = {},
): ToolRegistry<C> {
  const now = options.clock ?? Date.now;
  const { failureThreshold, cooldownMs } = options.breaker ?? BREAKER;
  const entries = new Map<string, Entry<C>>();

  const disabledBy = (e: Entry<C>): PluginDisabledBy | undefined =>
    e.byAdmin ? 'admin' : e.openUntil !== undefined && e.openUntil > now() ? 'breaker' : undefined;
  const stateOf = (e: Entry<C>): PluginState =>
    !e.loaded ? 'failed' : disabledBy(e) ? 'disabled' : 'loaded';
  const active = () => [...entries.values()].filter((e) => stateOf(e) === 'loaded');

  const statusOf = (e: Entry<C>): PluginStatus => {
    const by = disabledBy(e);
    return {
      id: e.plugin.id,
      version: e.plugin.version,
      state: stateOf(e),
      permissions: [...e.plugin.permissions],
      tools: e.plugin.tools.map((t) => t.name),
      ...(by ? { disabledBy: by } : {}),
      ...(by === 'breaker' ? { retryAt: new Date(e.openUntil!).toISOString() } : {}),
    };
  };

  const find = (name: string) => {
    for (const entry of active()) {
      const tool = entry.plugin.tools.find((t) => t.name === name);
      if (tool) return { entry, tool };
    }
    return undefined;
  };

  function record(entry: Entry<C>, tool: string, result: ToolRunResult): void {
    const trial = entry.openUntil !== undefined; // open and past its time: this call was the half-open trial
    if (result.ok) {
      entry.failures.set(tool, 0);
      if (trial) entry.openUntil = undefined;
      return;
    }
    if (!COUNTED.has(result.reason)) return;
    const count = (entry.failures.get(tool) ?? 0) + 1;
    entry.failures.set(tool, count);
    if (trial || count >= failureThreshold) {
      entry.openUntil = now() + cooldownMs;
      entry.failures.clear();
    }
  }

  return {
    async register(plugin) {
      const existing = entries.get(plugin.id);
      const names = plugin.tools.map((t) => t.name);
      const taken = new Set(
        [...entries.values()]
          .filter((e) => e.loaded)
          .flatMap((e) => e.plugin.tools.map((t) => t.name)),
      );
      const clash =
        existing?.loaded === true ||
        new Set(names).size !== names.length ||
        names.some((n) => taken.has(n));
      const entry: Entry<C> = {
        plugin,
        loaded: !clash,
        byAdmin: false,
        failures: new Map(),
      };
      if (!clash) {
        try {
          await plugin.setup?.({ pluginId: plugin.id });
        } catch {
          entry.loaded = false;
        }
      }
      // A refused duplicate must not replace the plugin that is already running.
      if (existing?.loaded !== true) entries.set(plugin.id, entry);
      return statusOf(entry);
    },

    unregister: (id) => entries.delete(id),

    enable(id) {
      const entry = entries.get(id);
      if (!entry) return undefined;
      entry.byAdmin = false;
      entry.openUntil = undefined;
      entry.failures.clear();
      return statusOf(entry);
    },

    disable(id) {
      const entry = entries.get(id);
      if (!entry) return undefined;
      entry.byAdmin = true;
      return statusOf(entry);
    },

    tools: () => active().flatMap((e) => e.plugin.tools),

    get: (name) => find(name)?.tool,

    list: () => [...entries.values()].map(statusOf),

    async execute(name, input, ctx, runOptions) {
      const found = find(name);
      if (!found) return failure('unknown_tool');
      const { entry, tool } = found;
      const capabilities = options.scope
        ? options.scope(ctx.capabilities, entry.plugin.permissions)
        : ctx.capabilities;
      const result = await runTool(tool, input, { ...ctx, capabilities }, runOptions);
      record(entry, name, result);
      return result;
    },
  };
}
