import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  AGENT_PROMPT_VERSION,
  buildAgentPrompt,
  buildComposePrompt,
  buildDebriefPromptFor,
  buildFollowupPrompt,
  buildLookupPrompt,
  buildRecapPrompt,
  buildSttPromptV3,
  buildSttPromptV4,
  buildTranslatePrompt,
  COMPOSE_PROMPT_VERSION,
  FOLLOWUP_PROMPT_VERSION,
  LOOKUP_PROMPT_VERSION,
  RECAP_PROMPT_VERSION,
  isContextEcho,
  STT_V3_PROMPT_VERSION,
  STT_V4_PROMPT_VERSION,
  type KnownSpeaker,
  TRANSLATE_PROMPT_VERSION,
  type TranslateInput,
  type DebriefSpeakerInput,
  type FollowupPromptInput,
} from '@cuelingo/prompts';
import type { ComposeRequest, LanguageCode, LookupRequest, RecapRequest } from '@cuelingo/shared';
import { generateText } from 'ai';
import {
  createGeminiStreamChat,
  type ChatMessage,
  type ChatStreamPart,
  type ChatToolDeclaration,
  type StreamChatFn,
} from './chat';
import { createGeminiSpeak, DEFAULT_VOICE, type SpeakFn } from './speech';
import {
  createGeminiTranscribe,
  parseSpeakerOutput,
  type SpeakerGuess,
  type TranscribeFn,
} from './stt';
import { TASKS, type JsonTaskName, type TaskName } from './tasks';

export interface AiCallRecord {
  task: TaskName;
  model: string;
  promptVersion: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  fallback: boolean;
  ok: boolean;
  /** Streaming tasks only: time to the first text or tool call. */
  firstTokenMs?: number;
  userId?: string;
  sessionId?: string;
}

export interface AiCallContext {
  userId?: string;
  sessionId?: string;
}

export interface LlmResult {
  text: string;
  model: string;
  fallback: boolean;
  latencyMs: number;
}

export interface JsonSchema<T> {
  parse(value: unknown): T;
}

export interface JsonTaskInputMap {
  'assist.lookup': LookupRequest;
  'assist.recap': RecapRequest;
  'assist.compose': ComposeRequest;
  'assist.followup': FollowupPromptInput;
  'debrief.generate': DebriefSpeakerInput;
}

export type GenerateFn = (args: {
  model: string;
  system: string;
  prompt: string;
  signal: AbortSignal;
}) => Promise<{ text: string; inputTokens?: number; outputTokens?: number }>;

export interface AiGatewayOptions {
  googleApiKey: string;
  /** Called once per attempt; the API turns this into an `ai_call` event. */
  onCall?: (record: AiCallRecord) => void;
  /** Test seam: replaces the real provider call. */
  generate?: GenerateFn;
  /** Test seam: replaces the real streaming call used by `chat`. */
  streamChat?: StreamChatFn;
  /** Test seam: replaces the real text-to-speech call. */
  speak?: SpeakFn;
  /** Test seam: replaces the real speech-to-text call. */
  transcribe?: TranscribeFn;
}

export interface AiGateway {
  llm(
    task: 'translate.realtime',
    input: TranslateInput,
    context?: AiCallContext,
  ): Promise<LlmResult>;
  /** Reads `text` aloud and returns a WAV. Callers cache the result: it takes seconds and costs money. */
  speech(
    text: string,
    options?: { voice?: string },
    context?: AiCallContext,
  ): Promise<SpeechResult>;
  /**
   * Transcribes one short utterance (a complete WAV). Never records or logs the audio or the text;
   * an empty `text` means no intelligible speech and is not an error. With `knownSpeakers` (even
   * an empty list) the call uses stt/v4 and the result also carries `speaker`; without it, stt/v3
   * and the result is the text alone. The hints and last sentences are never recorded or logged.
   */
  transcribe(
    input: {
      audio: Uint8Array;
      language: LanguageCode;
      previous?: string[];
      knownSpeakers?: KnownSpeaker[];
    },
    context?: AiCallContext,
  ): Promise<TranscribeResult>;
  /**
   * One streamed step of the assistant (`agent.chat`, prompt `agent.chat@v1`): text deltas, the tool calls
   * the model asked for, then a `finish` part. Tools are only declared, never run here. One `AiCallRecord`
   * per attempt. The primary model is replaced by the fallback only if it fails before sending anything.
   * Throws `AiGatewayError` on failure; if `signal` aborts the stream just ends. Messages are never logged.
   */
  chat(
    input: {
      language: LanguageCode;
      messages: ChatMessage[];
      tools: ChatToolDeclaration[];
      signal?: AbortSignal;
    },
    context?: AiCallContext,
  ): AsyncGenerator<ChatStreamPart, void, void>;
  json<TTask extends JsonTaskName, TOutput>(
    task: TTask,
    input: JsonTaskInputMap[TTask],
    schema: JsonSchema<TOutput>,
    context?: AiCallContext,
  ): Promise<TOutput>;
}

export interface SpeechResult {
  audio: Uint8Array;
  mimeType: 'audio/wav';
  model: string;
  fallback: boolean;
  latencyMs: number;
}

export interface TranscribeResult {
  text: string;
  /** Only when the call carried `knownSpeakers`. */
  speaker?: SpeakerGuess;
  model: string;
  fallback: boolean;
  latencyMs: number;
}

/** Upper bound of one assistant step (plan: <= 2k output tokens). */
const AGENT_MAX_OUTPUT_TOKENS = 2_000;

export class AiGatewayError extends Error {
  constructor(
    readonly task: TaskName,
    cause: unknown,
  ) {
    super(`AI task ${task} failed`, { cause });
  }
}

export function createAiGateway(options: AiGatewayOptions): AiGateway {
  const google = createGoogleGenerativeAI({ apiKey: options.googleApiKey });
  const generate: GenerateFn =
    options.generate ??
    (async ({ model, system, prompt, signal }) => {
      const result = await generateText({
        model: google(model),
        system,
        prompt,
        temperature: 0,
        abortSignal: signal,
        providerOptions: { google: { thinkingConfig: { thinkingLevel: 'minimal' } } },
      });
      return {
        text: result.text,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      };
    });

  async function attempt(
    task: TaskName,
    model: string,
    fallback: boolean,
    system: string,
    prompt: string,
    version: string,
    context?: AiCallContext,
  ) {
    const started = performance.now();
    const record: AiCallRecord = {
      task,
      model,
      promptVersion: version,
      latencyMs: 0,
      fallback,
      ok: false,
      ...context,
    };
    try {
      const out = await generate({
        model,
        system,
        prompt,
        signal: AbortSignal.timeout(TASKS[task].timeoutMs),
      });
      const text = out.text.trim();
      if (!text) throw new Error('empty completion');
      record.ok = true;
      record.inputTokens = out.inputTokens;
      record.outputTokens = out.outputTokens;
      return { text, model, fallback, latencyMs: Math.round(performance.now() - started) };
    } finally {
      record.latencyMs = Math.round(performance.now() - started);
      // Observability must never add latency to, or change the outcome of, an AI request.
      void Promise.resolve()
        .then(() => options.onCall?.(record))
        .catch(() => undefined);
    }
  }

  const speak: SpeakFn = options.speak ?? createGeminiSpeak(options.googleApiKey);

  async function speechAttempt(
    model: string,
    fallback: boolean,
    text: string,
    voice: string,
    context?: AiCallContext,
  ): Promise<SpeechResult> {
    const started = performance.now();
    const record: AiCallRecord = {
      task: 'tts.speak',
      model,
      promptVersion: 'tts@v1',
      latencyMs: 0,
      fallback,
      ok: false,
      ...context,
    };
    try {
      const out = await speak({
        model,
        text,
        voice,
        signal: AbortSignal.timeout(TASKS['tts.speak'].timeoutMs),
      });
      if (out.audio.length === 0) throw new Error('empty audio');
      record.ok = true;
      record.inputTokens = out.inputTokens;
      record.outputTokens = out.outputTokens;
      return {
        audio: out.audio,
        mimeType: out.mimeType,
        model,
        fallback,
        latencyMs: Math.round(performance.now() - started),
      };
    } finally {
      record.latencyMs = Math.round(performance.now() - started);
      void Promise.resolve()
        .then(() => options.onCall?.(record))
        .catch(() => undefined);
    }
  }

  const streamChat: StreamChatFn =
    options.streamChat ?? createGeminiStreamChat(options.googleApiKey);

  const transcribe: TranscribeFn =
    options.transcribe ?? createGeminiTranscribe(options.googleApiKey);

  async function transcribeAttempt(
    model: string,
    fallback: boolean,
    audio: Uint8Array,
    language: LanguageCode,
    previous: string[] | undefined,
    knownSpeakers: KnownSpeaker[] | undefined,
    context?: AiCallContext,
  ): Promise<TranscribeResult> {
    const started = performance.now();
    const record: AiCallRecord = {
      task: 'stt.transcribe',
      model,
      promptVersion: knownSpeakers ? STT_V4_PROMPT_VERSION : STT_V3_PROMPT_VERSION,
      latencyMs: 0,
      fallback,
      ok: false,
      ...context,
    };
    try {
      const { system, prompt } = knownSpeakers
        ? buildSttPromptV4({ language, previous, knownSpeakers })
        : buildSttPromptV3({ language, previous });
      const out = await transcribe({
        model,
        system,
        prompt,
        audio,
        ...(knownSpeakers ? { json: true } : {}),
        signal: AbortSignal.timeout(TASKS['stt.transcribe'].timeoutMs),
      });
      record.ok = true;
      record.inputTokens = out.inputTokens;
      record.outputTokens = out.outputTokens;
      // WAV: 44-byte header, then 16 kHz 16-bit mono PCM.
      const seconds = Math.max(0, audio.length - 44) / 32_000;
      const parsed = knownSpeakers ? parseSpeakerOutput(out.text) : undefined;
      const text = (parsed?.text ?? out.text).trim();
      return {
        // A model may echo the context on silence; on very short audio that is not speech.
        text: isContextEcho(text, previous, seconds) ? '' : text,
        ...(parsed ? { speaker: parsed.speaker } : {}),
        model,
        fallback,
        latencyMs: Math.round(performance.now() - started),
      };
    } finally {
      record.latencyMs = Math.round(performance.now() - started);
      void Promise.resolve()
        .then(() => options.onCall?.(record))
        .catch(() => undefined);
    }
  }

  async function runTextTask(
    task: TaskName,
    system: string,
    prompt: string,
    version: string,
    context?: AiCallContext,
  ): Promise<LlmResult> {
    const config = TASKS[task];
    try {
      return await attempt(task, config.model, false, system, prompt, version, context);
    } catch (primaryError) {
      // Only for the follow-up draft: asking the same model again would just double the worst case.
      if (task === 'assist.followup' && config.model === config.fallbackModel) {
        throw new AiGatewayError(task, primaryError);
      }
      try {
        return await attempt(task, config.fallbackModel, true, system, prompt, version, context);
      } catch (error) {
        throw new AiGatewayError(task, error);
      }
    }
  }

  function buildJsonTaskPrompt(task: JsonTaskName, input: JsonTaskInputMap[JsonTaskName]) {
    switch (task) {
      case 'assist.lookup':
        return { ...buildLookupPrompt(input as LookupRequest), version: LOOKUP_PROMPT_VERSION };
      case 'assist.recap':
        return { ...buildRecapPrompt(input as RecapRequest), version: RECAP_PROMPT_VERSION };
      case 'assist.compose':
        return { ...buildComposePrompt(input as ComposeRequest), version: COMPOSE_PROMPT_VERSION };
      case 'assist.followup':
        return {
          ...buildFollowupPrompt(input as FollowupPromptInput),
          version: FOLLOWUP_PROMPT_VERSION,
        };
      case 'debrief.generate':
        // v5 for meetings in a language nobody studies here, v4 otherwise (chosen by the language in the input).
        return buildDebriefPromptFor(input as DebriefSpeakerInput);
    }
  }

  return {
    async llm(task, input, context) {
      const { system, prompt } = buildTranslatePrompt(input);
      return runTextTask(task, system, prompt, TRANSLATE_PROMPT_VERSION, context);
    },

    async speech(text, speechOptions, context) {
      const voice = speechOptions?.voice ?? DEFAULT_VOICE;
      const config = TASKS['tts.speak'];
      try {
        return await speechAttempt(config.model, false, text, voice, context);
      } catch {
        try {
          return await speechAttempt(config.fallbackModel, true, text, voice, context);
        } catch (error) {
          throw new AiGatewayError('tts.speak', error);
        }
      }
    },

    async transcribe({ audio, language, previous, knownSpeakers }, context) {
      const config = TASKS['stt.transcribe'];
      try {
        return await transcribeAttempt(
          config.model,
          false,
          audio,
          language,
          previous,
          knownSpeakers,
          context,
        );
      } catch {
        try {
          return await transcribeAttempt(
            config.fallbackModel,
            true,
            audio,
            language,
            previous,
            knownSpeakers,
            context,
          );
        } catch {
          // The cause is dropped on purpose: nothing from the request may travel up with the error.
          throw new AiGatewayError('stt.transcribe', undefined);
        }
      }
    },

    async *chat({ language, messages, tools, signal }, context) {
      const config = TASKS['agent.chat'];
      const { system } = buildAgentPrompt({ language });
      const models = [{ model: config.model, fallback: false }];
      if (config.fallbackModel !== config.model)
        models.push({ model: config.fallbackModel, fallback: true });

      let lastError: unknown;
      for (const { model, fallback } of models) {
        const started = performance.now();
        const record: AiCallRecord = {
          task: 'agent.chat',
          model,
          promptVersion: AGENT_PROMPT_VERSION,
          latencyMs: 0,
          fallback,
          ok: false,
          ...context,
        };
        let produced = false;
        let received = 0;
        try {
          const stepSignal = AbortSignal.any([
            AbortSignal.timeout(config.timeoutMs),
            ...(signal ? [signal] : []),
          ]);
          for await (const part of streamChat({
            model,
            system,
            messages,
            tools,
            maxOutputTokens: AGENT_MAX_OUTPUT_TOKENS,
            signal: stepSignal,
          })) {
            if (part.type === 'finish') {
              if (!produced) throw new Error('empty completion');
              record.ok = true;
              record.inputTokens = part.inputTokens;
              record.outputTokens = part.outputTokens;
            } else if (part.type !== 'text_delta' || part.text) {
              if (!produced) record.firstTokenMs = Math.round(performance.now() - started);
              produced = true;
            }
            if (part.type === 'text_delta') received += part.text.length;
            yield part;
          }
          if (!record.ok) throw new Error('stream ended without a finish part');
          return;
        } catch (error) {
          if (signal?.aborted) return;
          lastError = error;
          if (produced) break;
        } finally {
          if (!record.ok && signal?.aborted && record.inputTokens === undefined) {
            // Stop must not dodge the cost: the provider bills what was read, so estimate it (about 4 chars/token).
            const sent = messages.reduce((sum, m) => sum + JSON.stringify(m).length, system.length);
            record.inputTokens = Math.ceil(sent / 4);
            record.outputTokens = Math.ceil(received / 4);
          }
          record.latencyMs = Math.round(performance.now() - started);
          void Promise.resolve()
            .then(() => options.onCall?.(record))
            .catch(() => undefined);
        }
      }
      throw new AiGatewayError('agent.chat', lastError);
    },

    async json(task, input, schema, context) {
      const { system, prompt, version } = buildJsonTaskPrompt(task, input);
      let parseError: unknown;
      for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
        const retryInstruction =
          attemptIndex === 0
            ? ''
            : '\n\nYour previous response was invalid. Return only valid JSON matching the requested shape.';
        const result = await runTextTask(task, system, prompt + retryInstruction, version, context);
        try {
          return schema.parse(JSON.parse(result.text));
        } catch (error) {
          parseError = error;
        }
      }
      throw new AiGatewayError(task, parseError);
    },
  };
}
