/**
 * @cuelingo/ai-gateway — Lớp trừu tượng nhà cung cấp AI: STT, LLM, TTS; routing theo tác vụ; log chi phí và độ trễ; fallback.
 * Design: apps/docs/docs/04-modules/05-packages/ai-gateway.md
 */
export { AiGatewayError, createAiGateway } from './gateway';
export type {
  AiCallRecord,
  AiCallContext,
  AiGateway,
  AiGatewayOptions,
  GenerateFn,
  JsonSchema,
  JsonTaskInputMap,
  LlmResult,
  SpeechResult,
  TranscribeResult,
} from './gateway';
export { DEFAULT_VOICE, wrapPcmAsWav } from './speech';
export type { SpeakFn } from './speech';
export type { SpeakerGuess, SpeakerLabel, TranscribeFn } from './stt';
export { TASKS } from './tasks';
export type { JsonTaskName, TaskName } from './tasks';
export { estimateCostUsd, MODEL_PRICES } from './pricing';
export type { ModelPrice } from './pricing';
