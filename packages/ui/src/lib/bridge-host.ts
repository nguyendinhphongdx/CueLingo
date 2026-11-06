import {
  BRIDGE_RATE_LIMITS,
  BRIDGE_VERSION,
  BridgePongSchema,
  BridgeRequestSchema,
  MAX_BRIDGE_MESSAGE_BYTES,
  MAX_BRIDGE_PHRASES,
  isBridgeOp,
  isDataOp,
  type BridgeErrorCode,
  type BridgeOp,
  type BridgeRequest,
  type BridgeResponse,
} from '@cuelingo/shared';

/**
 * The host side of the bridge between a sandboxed block and the page (ADR 0019). The block is hostile: it can send
 * anything, any time. Every message passes, in order: who sent it (`source`), where from (`origin`), how big,
 * whether it is a known operation with valid arguments, and how often. Only then does one of the handlers run,
 * and the handlers are the only thing the block can ever reach. No `userId`, no token, no network.
 */

/** The parts of a `MessageEvent` the host reads; a plain object in tests. */
export interface BridgeMessageEvent {
  origin: string;
  source: unknown;
  data: unknown;
}

export interface BridgePhrase {
  phrase: string;
  meaningVi: string | null;
}

export interface BridgeHandlers {
  resize(height: number): void;
  ready(): void;
  /** The page reported an error or the browser blocked something it tried: the host removes the block. */
  error(message: string): void;
  pong(n: number): void;
  listPhrases(): Promise<BridgePhrase[]>;
  /** Asks the person (a dialog drawn by the host). Resolves true only if they agree. */
  confirmSave(input: { phrase: string; meaningVi?: string }): Promise<boolean>;
  /** Saves after `confirmSave` said yes. */
  savePhrase(input: { phrase: string; meaningVi?: string }): Promise<void>;
  speak(text: string): void | Promise<void>;
}

export type RejectReason =
  | 'disposed'
  | 'wrong_source'
  | 'wrong_origin'
  | 'unserializable'
  | 'too_large'
  | 'flood'
  | 'op_not_allowed'
  | 'invalid'
  | 'rate_limited'
  | 'busy'
  | 'declined'
  | 'failed';

export interface BridgeHostOptions {
  /** The runner iframe's window. A message from any other window is dropped. */
  getFrameWindow(): unknown;
  /** Sends the answer back into the frame. */
  reply(response: BridgeResponse): void;
  handlers: BridgeHandlers;
  /**
   * Origins accepted on `event.origin`. A frame without `allow-same-origin` has an opaque origin and the browser
   * reports it as the string "null"; the runner's real origin never appears. Default: only "null".
   */
  acceptedOrigins?: readonly string[];
  now?: () => number;
  /** Told about every refused message: the reason and the operation name if it is on the allowlist. Never contents. */
  onRejected?(info: { reason: RejectReason; op: BridgeOp | 'unknown' }): void;
}

export interface BridgeHost {
  handleMessage(event: BridgeMessageEvent): Promise<void>;
  /** After this every message is dropped, and a pending confirmation is not acted on. */
  dispose(): void;
}

const MINUTE_MS = 60_000;
/** Every message that passes source and origin counts here, valid or not, so garbage cannot keep the host busy. */
const MAX_MESSAGES_PER_MINUTE = 300;
const encoder = new TextEncoder();

/** The size of `data` as JSON in bytes, or null if it cannot be serialised (a cycle, a function, a BigInt). */
function sizeOf(data: unknown): number | null {
  try {
    const json = JSON.stringify(data);
    return typeof json === 'string' ? encoder.encode(json).length : null;
  } catch {
    return null;
  }
}

/** The id to answer with, only if it is a short string; anything else gets no answer. */
function idOf(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const id = (data as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 && id.length <= 64 ? id : null;
}

function trim(timestamps: number[], now: number): number[] {
  return timestamps.filter((at) => now - at < MINUTE_MS);
}

export function createBridgeHost(options: BridgeHostOptions): BridgeHost {
  const { handlers } = options;
  const accepted = options.acceptedOrigins ?? ['null'];
  const now = options.now ?? Date.now;
  let disposed = false;
  let saving = false;
  let all: number[] = [];
  let data: number[] = [];
  let ui: number[] = [];

  const reject = (reason: RejectReason, op: BridgeOp | 'unknown' = 'unknown') =>
    options.onRejected?.({ reason, op });

  const fail = (
    id: string | null,
    error: BridgeErrorCode,
    op: BridgeOp | 'unknown' = 'unknown',
  ) => {
    reject(error, op);
    if (id) options.reply({ v: BRIDGE_VERSION, id, ok: false, error });
  };

  async function run(request: BridgeRequest): Promise<BridgeResponse> {
    const ok = (extra?: { phrases: BridgePhrase[] }): BridgeResponse => ({
      v: BRIDGE_VERSION,
      id: request.id,
      ok: true,
      ...(extra ? { data: extra } : {}),
    });
    const no = (error: BridgeErrorCode): BridgeResponse => {
      reject(error, request.op);
      return { v: BRIDGE_VERSION, id: request.id, ok: false, error };
    };
    try {
      switch (request.op) {
        case 'ui.resize':
          handlers.resize(request.args.height);
          return ok();
        case 'ui.ready':
          handlers.ready();
          return ok();
        case 'ui.error':
          handlers.error(request.args.message);
          return ok();
        case 'phrases.list': {
          const phrases = (await handlers.listPhrases()).slice(0, MAX_BRIDGE_PHRASES).map((p) => ({
            phrase: p.phrase.slice(0, 200),
            meaningVi: p.meaningVi === null ? null : p.meaningVi.slice(0, 500),
          }));
          return ok({ phrases });
        }
        case 'phrases.save': {
          // One question at a time: a page cannot stack dialogs to wear the person down.
          if (saving) return no('busy');
          saving = true;
          try {
            const input = {
              phrase: request.args.phrase,
              ...(request.args.meaningVi ? { meaningVi: request.args.meaningVi } : {}),
            };
            // Writing always asks the person first; there is no path to `savePhrase` around this line.
            if (!(await handlers.confirmSave(input))) return no('declined');
            if (disposed) return no('failed');
            await handlers.savePhrase(input);
            return ok();
          } finally {
            saving = false;
          }
        }
        case 'tts.speak':
          await handlers.speak(request.args.text);
          return ok();
      }
    } catch {
      return no('failed');
    }
  }

  return {
    async handleMessage(event) {
      if (disposed) return reject('disposed');
      const frame = options.getFrameWindow();
      // Identity first: only the runner iframe's own window passes. A page, another frame or an extension cannot
      // forge it, whatever the message says.
      if (frame === null || frame === undefined || event.source !== frame) {
        return reject('wrong_source');
      }
      if (!accepted.includes(event.origin)) return reject('wrong_origin');

      const at = now();
      all = trim(all, at);
      if (all.length >= MAX_MESSAGES_PER_MINUTE) return reject('flood');
      all.push(at);

      const size = sizeOf(event.data);
      if (size === null) return reject('unserializable');
      if (size > MAX_BRIDGE_MESSAGE_BYTES) return fail(idOf(event.data), 'too_large');

      const pong = BridgePongSchema.safeParse(event.data);
      if (pong.success) return handlers.pong(pong.data.n);

      const op = (event.data as { op?: unknown } | null)?.op;
      const id = idOf(event.data);
      if (!isBridgeOp(op)) return fail(id, 'op_not_allowed');

      const parsed = BridgeRequestSchema.safeParse(event.data);
      if (!parsed.success) return fail(id, 'invalid', op);

      const request = parsed.data;
      if (isDataOp(request.op)) {
        data = trim(data, at);
        if (data.length >= BRIDGE_RATE_LIMITS.dataPerMinute) {
          return fail(request.id, 'rate_limited', request.op);
        }
        data.push(at);
      } else {
        ui = trim(ui, at);
        if (ui.length >= BRIDGE_RATE_LIMITS.uiPerMinute) {
          return fail(request.id, 'rate_limited', request.op);
        }
        ui.push(at);
      }

      const response = await run(request);
      // The block may have been removed while a handler (a dialog, a request) was pending.
      if (!disposed) options.reply(response);
    },
    dispose() {
      disposed = true;
    },
  };
}
