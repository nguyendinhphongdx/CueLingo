/**
 * @cuelingo/agent — harness của trợ lý AI, không I/O: cổng mô hình, cắt ngữ cảnh, công cụ/plugin, vòng lặp một lượt.
 * Design: apps/docs/docs/04-modules/05-packages/agent.md
 */
export { buildContext, estimateMessageTokens, estimateTokens } from './context';
export type { BuiltContext, ContextOptions } from './context';
export { BREAKER, DEFAULT_LIMITS, MAX_TOOL_OUTPUT_BYTES } from './limits';
export type { TurnLimits } from './limits';
export { runTurn } from './loop';
export type { TurnHooks, TurnInput } from './loop';
export type {
  ModelEvent,
  ModelMessage,
  ModelPort,
  ModelStepInput,
  ModelToolCall,
  ModelToolDeclaration,
} from './model';
export { createPartsBuilder } from './parts';
export type { PartsBuilder } from './parts';
export type {
  AgentPlugin,
  PluginDisabledBy,
  PluginHost,
  PluginState,
  PluginStatus,
} from './plugin';
export { createToolRegistry } from './registry';
export type { ToolRegistry, ToolRegistryOptions } from './registry';
export { cutOutput, defineTool, failure, runTool, toDeclaration, TOOL_ERRORS_VI } from './tools';
export type {
  AgentPermission,
  AgentTool,
  RunToolOptions,
  ToolContext,
  ToolFailure,
  ToolRunResult,
} from './tools';
