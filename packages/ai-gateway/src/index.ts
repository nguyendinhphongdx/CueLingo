/**
 * @cuelingo/ai-gateway — Lớp trừu tượng nhà cung cấp AI: STT, LLM, TTS; routing theo tác vụ; log chi phí và độ trễ; fallback.
 * Design: apps/docs/docs/04-modules/05-packages/ai-gateway.md
 */
export { AiGatewayError, createAiGateway } from './gateway';
export type {
  AiCallRecord,
  AiGateway,
  AiGatewayOptions,
  GenerateFn,
  JsonSchema,
  JsonTaskInputMap,
  LlmResult,
} from './gateway';
export { TASKS } from './tasks';
export type { JsonTaskName, TaskName } from './tasks';
