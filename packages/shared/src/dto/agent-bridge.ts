import { z } from 'zod';

/**
 * AI-generated interface, layer 2 (ADR 0019): HTML/JS the assistant wrote, shown in a sandboxed frame, and the
 * messages that frame may exchange with the page that hosts it. The host is the only authority: everything that
 * comes from the frame is untrusted and is validated against these schemas before anything happens.
 */

export const BRIDGE_VERSION = 1 as const;

/** Most UTF-8 bytes of the HTML of one block. */
export const MAX_HTML_BLOCK_BYTES = 64 * 1024;
/** Most bytes of one message the frame sends to the host; bigger ones are dropped unread. */
export const MAX_BRIDGE_MESSAGE_BYTES = 16 * 1024;
/** Most phrases `phrases.list` returns. */
export const MAX_BRIDGE_PHRASES = 50;
/** Height range the host accepts for `ui.resize`, in CSS pixels. */
export const MIN_BLOCK_HEIGHT = 40;
export const MAX_BLOCK_HEIGHT = 1200;
/** Messages per minute and per block: data operations (phrases, speech) are few, UI chatter (resize) is looser. */
export const BRIDGE_RATE_LIMITS = { dataPerMinute: 20, uiPerMinute: 120 } as const;

const utf8Bytes = (text: string): number => new TextEncoder().encode(text).length;

/** The HTML text of a block: non-empty and at most `MAX_HTML_BLOCK_BYTES`. */
export const HtmlSourceSchema = z
  .string()
  .min(1)
  .refine((html) => utf8Bytes(html) <= MAX_HTML_BLOCK_BYTES, {
    message: `html is over ${MAX_HTML_BLOCK_BYTES} bytes`,
  });

/** Data of the `html_block` card: one self-contained page, rendered only in the sandbox runner. */
export const HtmlBlockSchema = z
  .object({ title: z.string().trim().min(1).max(120).optional(), html: HtmlSourceSchema })
  .strict();
export type HtmlBlock = z.infer<typeof HtmlBlockSchema>;

/** What the frame may ask the host to do. Anything else is refused. */
export const BRIDGE_OPS = [
  'ui.resize',
  'ui.ready',
  'ui.error',
  'phrases.list',
  'phrases.save',
  'tts.speak',
] as const;
export type BridgeOp = (typeof BRIDGE_OPS)[number];
export const isBridgeOp = (value: unknown): value is BridgeOp =>
  typeof value === 'string' && (BRIDGE_OPS as readonly string[]).includes(value);

/** Operations that read or change the user's data or play sound; the rest only describe the frame. */
export const isDataOp = (op: BridgeOp): boolean => !op.startsWith('ui.');

const MessageId = z.string().min(1).max(64);
const NoArgs = z.object({}).strict().optional();

const request = <Op extends BridgeOp, A extends z.ZodType>(op: Op, args: A) =>
  z.object({ v: z.literal(BRIDGE_VERSION), id: MessageId, op: z.literal(op), args }).strict();

/** One request from the frame: `{v:1, id, op, args}`. The answer carries the same `id`. */
export const BridgeRequestSchema = z.discriminatedUnion('op', [
  request(
    'ui.resize',
    z.object({ height: z.number().int().min(MIN_BLOCK_HEIGHT).max(MAX_BLOCK_HEIGHT) }).strict(),
  ),
  request('ui.ready', NoArgs),
  request('ui.error', z.object({ message: z.string().max(200) }).strict()),
  request('phrases.list', NoArgs),
  request(
    'phrases.save',
    z
      .object({
        phrase: z.string().trim().min(1).max(200),
        meaningVi: z.string().trim().max(500).optional(),
      })
      .strict(),
  ),
  request('tts.speak', z.object({ text: z.string().trim().min(1).max(300) }).strict()),
]);
export type BridgeRequest = z.infer<typeof BridgeRequestSchema>;

/** The runner answers the host's ping with this; it is not an operation and carries nothing else. */
export const BridgePongSchema = z
  .object({ v: z.literal(BRIDGE_VERSION), kind: z.literal('pong'), n: z.number().int().min(0) })
  .strict();
export type BridgePong = z.infer<typeof BridgePongSchema>;

export const BridgeErrorCodeSchema = z.enum([
  'op_not_allowed',
  'invalid',
  'too_large',
  'rate_limited',
  'declined',
  'busy',
  'failed',
]);
export type BridgeErrorCode = z.infer<typeof BridgeErrorCodeSchema>;

/** Phrases the frame may read: the phrase and its meaning, nothing else about the user. */
export const BridgePhraseSchema = z
  .object({ phrase: z.string().max(200), meaningVi: z.string().max(500).nullable() })
  .strict();

export const BridgeResponseSchema = z.union([
  z
    .object({
      v: z.literal(BRIDGE_VERSION),
      id: MessageId,
      ok: z.literal(true),
      data: z
        .object({ phrases: z.array(BridgePhraseSchema).max(MAX_BRIDGE_PHRASES) })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      v: z.literal(BRIDGE_VERSION),
      id: MessageId,
      ok: z.literal(false),
      error: BridgeErrorCodeSchema,
    })
    .strict(),
]);
export type BridgeResponse = z.infer<typeof BridgeResponseSchema>;

/** What the host sends into the runner: the page to draw, a liveness ping, or the answer to a request. */
export const BridgeHostMessageSchema = z.discriminatedUnion('kind', [
  z
    .object({ v: z.literal(BRIDGE_VERSION), kind: z.literal('render'), html: HtmlSourceSchema })
    .strict(),
  z
    .object({ v: z.literal(BRIDGE_VERSION), kind: z.literal('ping'), n: z.number().int().min(0) })
    .strict(),
  z
    .object({
      v: z.literal(BRIDGE_VERSION),
      kind: z.literal('reply'),
      response: BridgeResponseSchema,
    })
    .strict(),
]);
export type BridgeHostMessage = z.infer<typeof BridgeHostMessageSchema>;
