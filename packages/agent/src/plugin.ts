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

export type PluginState = 'loaded' | 'failed' | 'disabled';

/** Why a plugin is `disabled`: an admin switched it off, or the circuit breaker did (until `retryAt`). */
export type PluginDisabledBy = 'admin' | 'breaker';

export interface PluginStatus {
  id: string;
  version: string;
  state: PluginState;
  permissions: AgentPermission[];
  /** Names of the tools the plugin declares, whatever its state. */
  tools: string[];
  disabledBy?: PluginDisabledBy;
  /** ISO time after which a breaker-disabled plugin gets a trial call. */
  retryAt?: string;
}
