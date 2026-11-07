import { AgentCardSchema, type AgentCard } from '@cuelingo/shared';
import { z } from 'zod';
import { DEFAULT_LIMITS, MAX_TOOL_OUTPUT_BYTES } from './limits';
import type { ModelToolDeclaration } from './model';

/** What a plugin may be allowed to touch; the API builds `capabilities` from the declared ones. */
export type AgentPermission = 'phrases:read' | 'phrases:write' | 'lookup' | 'cards' | 'html';

export interface ToolContext<C = unknown> {
  /** A facade already bound to the signed-in user by the API. Tools never see a raw `userId` or SQL. */
  capabilities: C;
  signal: AbortSignal;
}

export interface AgentTool<C = unknown> {
  name: string;
  description: string;
  /** `write` tools change user data; a turn may call at most `maxWriteCalls` of them. */
  kind: 'read' | 'write';
  input: z.ZodType;
  output: z.ZodType;
  run(input: unknown, ctx: ToolContext<C>): Promise<unknown>;
  /** A card to show the user for a successful result (validated against `AgentCardSchema`). */
  toCard?(output: unknown): AgentCard | undefined;
  /** One short Vietnamese line for the tool step; never raw output. */
  summarize?(output: unknown): string | undefined;
  /** What the model reads back, when that must be less than the card needs (e.g. a page it wrote itself). */
  forModel?(output: unknown): unknown;
}

/** Declares a tool with typed `run`/`toCard`/`summarize`; the types are erased for the registry. */
export function defineTool<C, I, O>(tool: {
  name: string;
  description: string;
  kind: 'read' | 'write';
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  run(input: I, ctx: ToolContext<C>): Promise<O>;
  toCard?(output: O): AgentCard | undefined;
  summarize?(output: O): string | undefined;
  forModel?(output: O): unknown;
}): AgentTool<C> {
  return tool as unknown as AgentTool<C>;
}

export function toDeclaration(
  tool: Pick<AgentTool, 'name' | 'description' | 'input'>,
): ModelToolDeclaration {
  const { $schema: _ignored, ...inputSchema } = z.toJSONSchema(tool.input) as Record<
    string,
    unknown
  >;
  return { name: tool.name, description: tool.description, inputSchema };
}

export type ToolFailure =
  'unknown_tool' | 'invalid_input' | 'timeout' | 'aborted' | 'failed' | 'invalid_output' | 'limit';

/** Sentences shown to the user and the model when a tool does not deliver. Never the original error. */
export const TOOL_ERRORS_VI: Record<ToolFailure, string> = {
  unknown_tool: 'Công cụ này không tồn tại.',
  invalid_input: 'Công cụ nhận dữ liệu không hợp lệ.',
  timeout: 'Công cụ phản hồi quá chậm, đã bỏ qua.',
  aborted: 'Đã dừng công cụ.',
  failed: 'Công cụ gặp lỗi, đã bỏ qua.',
  invalid_output: 'Công cụ trả về dữ liệu không hợp lệ.',
  limit: 'Đã đạt giới hạn số lần lưu trong một lượt.',
};

export type ToolRunResult =
  | { ok: true; output: unknown; content: string; summary?: string; card?: AgentCard }
  | { ok: false; reason: ToolFailure; error: string; content: string };

export const failure = (reason: ToolFailure): ToolRunResult => {
  const error = TOOL_ERRORS_VI[reason];
  return { ok: false, reason, error, content: JSON.stringify({ ok: false, error }) };
};

const encoder = new TextEncoder();
const byteLength = (text: string) => encoder.encode(text).length;

/** Output text for the model context, cut to `maxBytes`; a cut result says so and is still valid JSON. */
export function cutOutput(output: unknown, maxBytes = MAX_TOOL_OUTPUT_BYTES): string {
  const full = JSON.stringify(output ?? null);
  if (byteLength(full) <= maxBytes) return full;
  const wrap = (preview: string) => JSON.stringify({ truncated: true, preview });
  let end = Math.min(full.length, maxBytes);
  while (end > 0 && byteLength(wrap(full.slice(0, end))) > maxBytes) end -= Math.ceil(end / 8) || 1;
  return wrap(full.slice(0, Math.max(0, end)));
}

export interface RunToolOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
}

/**
 * Runs one tool call safely: validates the input, enforces the timeout and the abort signal, validates and
 * cuts the output. Never throws; every failure is a `ToolRunResult` with a Vietnamese sentence.
 */
export async function runTool<C>(
  tool: AgentTool<C>,
  rawInput: unknown,
  ctx: ToolContext<C>,
  options: RunToolOptions = {},
): Promise<ToolRunResult> {
  const { timeoutMs = DEFAULT_LIMITS.toolTimeoutMs, maxOutputBytes = MAX_TOOL_OUTPUT_BYTES } =
    options;
  const input = tool.input.safeParse(rawInput);
  if (!input.success) return failure('invalid_input');
  if (ctx.signal.aborted) return failure('aborted');

  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = AbortSignal.any([ctx.signal, timeout]);
  let onAbort: (() => void) | undefined;
  const stopped = new Promise<ToolRunResult>((resolve) => {
    onAbort = () => resolve(failure(ctx.signal.aborted ? 'aborted' : 'timeout'));
    signal.addEventListener('abort', onAbort, { once: true });
  });

  try {
    const raced = await Promise.race([
      tool.run(input.data, { ...ctx, signal }).then(
        (value) => ({ value }),
        () => failure('failed'),
      ),
      stopped,
    ]);
    if ('ok' in raced) return raced;
    const output = tool.output.safeParse(raced.value);
    if (!output.success) return failure('invalid_output');

    let card: AgentCard | undefined;
    let summary: string | undefined;
    let modelView: unknown = output.data;
    try {
      if (tool.forModel) modelView = tool.forModel(output.data);
      const candidate = tool.toCard?.(output.data);
      if (candidate) {
        const parsed = AgentCardSchema.safeParse(candidate);
        if (parsed.success) card = parsed.data;
      }
      summary = tool.summarize?.(output.data)?.slice(0, 300);
    } catch {
      // A broken presenter must not lose a result that already succeeded.
    }
    return {
      ok: true,
      output: output.data,
      content: cutOutput(modelView, maxOutputBytes),
      ...(summary ? { summary } : {}),
      ...(card ? { card } : {}),
    };
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}
