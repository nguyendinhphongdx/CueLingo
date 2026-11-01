import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  buildComposePrompt,
  buildLookupPrompt,
  buildRecapPrompt,
  buildTranslatePrompt,
  COMPOSE_PROMPT_VERSION,
  LOOKUP_PROMPT_VERSION,
  RECAP_PROMPT_VERSION,
  TRANSLATE_PROMPT_VERSION,
  type TranslateInput,
} from '@cuelingo/prompts';
import type { ComposeRequest, LookupRequest, RecapRequest } from '@cuelingo/shared';
import { generateText } from 'ai';
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
}

export interface AiGateway {
  llm(task: 'translate.realtime', input: TranslateInput): Promise<LlmResult>;
  json<TTask extends JsonTaskName, TOutput>(
    task: TTask,
    input: JsonTaskInputMap[TTask],
    schema: JsonSchema<TOutput>,
  ): Promise<TOutput>;
}

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
  ) {
    const started = performance.now();
    const record: AiCallRecord = {
      task,
      model,
      promptVersion: version,
      latencyMs: 0,
      fallback,
      ok: false,
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
      options.onCall?.(record);
    }
  }

  async function runTextTask(
    task: TaskName,
    system: string,
    prompt: string,
    version: string,
  ): Promise<LlmResult> {
    const config = TASKS[task];
    try {
      return await attempt(task, config.model, false, system, prompt, version);
    } catch {
      try {
        return await attempt(task, config.fallbackModel, true, system, prompt, version);
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
    }
  }

  return {
    async llm(task, input) {
      const { system, prompt } = buildTranslatePrompt(input);
      return runTextTask(task, system, prompt, TRANSLATE_PROMPT_VERSION);
    },

    async json(task, input, schema) {
      const { system, prompt, version } = buildJsonTaskPrompt(task, input);
      let parseError: unknown;
      for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
        const retryInstruction =
          attemptIndex === 0
            ? ''
            : '\n\nYour previous response was invalid. Return only valid JSON matching the requested shape.';
        const result = await runTextTask(task, system, prompt + retryInstruction, version);
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
