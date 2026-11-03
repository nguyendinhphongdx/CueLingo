/** Task → model routing. Callers name the task, never the model (convention: ai-calls). */
export const TASKS = {
  'translate.realtime': {
    model: process.env.AI_TRANSLATE_MODEL ?? 'gemini-3.1-flash-lite',
    fallbackModel: process.env.AI_TRANSLATE_FALLBACK_MODEL ?? 'gemini-3.5-flash-lite',
    timeoutMs: 3_000,
  },
  'assist.lookup': {
    model: process.env.AI_ASSIST_MODEL ?? 'gemini-3.5-flash-lite',
    fallbackModel: process.env.AI_ASSIST_MODEL ?? 'gemini-3.5-flash-lite',
    timeoutMs: 8_000,
  },
  'assist.recap': {
    model: process.env.AI_ASSIST_MODEL ?? 'gemini-3.5-flash-lite',
    fallbackModel: process.env.AI_ASSIST_MODEL ?? 'gemini-3.5-flash-lite',
    timeoutMs: 8_000,
  },
  'assist.compose': {
    model: process.env.AI_ASSIST_MODEL ?? 'gemini-3.5-flash-lite',
    fallbackModel: process.env.AI_ASSIST_MODEL ?? 'gemini-3.5-flash-lite',
    timeoutMs: 8_000,
  },
  'debrief.generate': {
    model: process.env.AI_DEBRIEF_MODEL ?? 'gemini-3.5-flash-lite',
    fallbackModel: process.env.AI_DEBRIEF_MODEL ?? 'gemini-3.5-flash-lite',
    timeoutMs: 60_000,
  },
  'tts.speak': {
    model: process.env.AI_TTS_MODEL ?? 'gemini-3.8-flash-lite-tts',
    fallbackModel: process.env.AI_TTS_FALLBACK_MODEL ?? 'gemini-3.8-flash-tts',
    timeoutMs: 20_000,
  },
  // Needs a model that accepts audio input. Utterances are short; the caller retries once (ADR 0014).
  'stt.transcribe': {
    model: process.env.AI_STT_MODEL ?? 'gemini-3.5-flash-lite',
    fallbackModel: process.env.AI_STT_FALLBACK_MODEL ?? 'gemini-3.1-flash-lite',
    timeoutMs: 7_000,
  },
} as const;
export type TaskName = keyof typeof TASKS;
export type JsonTaskName = Exclude<TaskName, 'translate.realtime' | 'tts.speak' | 'stt.transcribe'>;
