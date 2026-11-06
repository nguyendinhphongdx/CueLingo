import { describe, expect, it } from 'vitest';
import { AgentCardSchema, MessagePartSchema } from './agent.dto';
import {
  BRIDGE_OPS,
  BridgeHostMessageSchema,
  BridgePongSchema,
  BridgeRequestSchema,
  BridgeResponseSchema,
  HtmlBlockSchema,
  MAX_HTML_BLOCK_BYTES,
  isBridgeOp,
  isDataOp,
} from './agent-bridge';

const req = (op: string, args?: unknown, over: Record<string, unknown> = {}) => ({
  v: 1,
  id: 'r1',
  op,
  ...(args === undefined ? {} : { args }),
  ...over,
});

describe('HtmlBlockSchema', () => {
  it('accepts a page and an optional title', () => {
    expect(HtmlBlockSchema.safeParse({ html: '<p>hi</p>' }).success).toBe(true);
    expect(HtmlBlockSchema.safeParse({ title: 'Quiz', html: '<p>hi</p>' }).success).toBe(true);
  });

  it('limits the page to 64 KB of UTF-8, counting bytes and not characters', () => {
    expect(HtmlBlockSchema.safeParse({ html: 'a'.repeat(MAX_HTML_BLOCK_BYTES) }).success).toBe(
      true,
    );
    expect(HtmlBlockSchema.safeParse({ html: 'a'.repeat(MAX_HTML_BLOCK_BYTES + 1) }).success).toBe(
      false,
    );
    // 3 bytes each: fewer characters than the limit, more bytes.
    expect(HtmlBlockSchema.safeParse({ html: 'ạ'.repeat(30_000) }).success).toBe(false);
  });

  it('rejects an empty page and extra fields', () => {
    expect(HtmlBlockSchema.safeParse({ html: '' }).success).toBe(false);
    expect(HtmlBlockSchema.safeParse({ html: '<p/>', src: 'https://x.test' }).success).toBe(false);
  });

  it('is a card kind, so a stored message with a block parses', () => {
    const card = { kind: 'html_block', data: { html: '<p>hi</p>' } };
    expect(AgentCardSchema.safeParse(card).success).toBe(true);
    expect(MessagePartSchema.safeParse({ type: 'card', card }).success).toBe(true);
    expect(
      AgentCardSchema.safeParse({ kind: 'html_block', data: { html: '<p/>', extra: 1 } }).success,
    ).toBe(false);
  });
});

describe('BridgeRequestSchema', () => {
  it('knows exactly the six allowed operations', () => {
    expect([...BRIDGE_OPS]).toEqual([
      'ui.resize',
      'ui.ready',
      'ui.error',
      'phrases.list',
      'phrases.save',
      'tts.speak',
    ]);
    expect(isBridgeOp('phrases.save')).toBe(true);
    expect(isBridgeOp('fs.read')).toBe(false);
    expect(isBridgeOp(undefined)).toBe(false);
    expect(isDataOp('ui.resize')).toBe(false);
    expect(isDataOp('phrases.list')).toBe(true);
    expect(isDataOp('tts.speak')).toBe(true);
  });

  it('accepts each operation with its arguments', () => {
    for (const message of [
      req('ui.resize', { height: 240 }),
      req('ui.ready'),
      req('ui.ready', {}),
      req('ui.error', { message: 'boom' }),
      req('phrases.list'),
      req('phrases.save', { phrase: 'circle back', meaningVi: 'quay lại sau' }),
      req('tts.speak', { text: 'Let us circle back.' }),
    ])
      expect(BridgeRequestSchema.safeParse(message).success, JSON.stringify(message)).toBe(true);
  });

  it('refuses unknown operations, a wrong version and extra fields', () => {
    expect(BridgeRequestSchema.safeParse(req('fetch', { url: 'https://x.test' })).success).toBe(
      false,
    );
    expect(BridgeRequestSchema.safeParse(req('ui.ready', undefined, { v: 2 })).success).toBe(false);
    expect(BridgeRequestSchema.safeParse(req('ui.ready', undefined, { userId: 'u' })).success).toBe(
      false,
    );
    expect(BridgeRequestSchema.safeParse(req('phrases.list', { userId: 'u' })).success).toBe(false);
    expect(
      BridgeRequestSchema.safeParse(req('phrases.save', { phrase: 'x', sessionId: 'y' })).success,
    ).toBe(false);
  });

  it('bounds every argument', () => {
    expect(BridgeRequestSchema.safeParse(req('ui.resize', { height: 5 })).success).toBe(false);
    expect(BridgeRequestSchema.safeParse(req('ui.resize', { height: 5000 })).success).toBe(false);
    expect(BridgeRequestSchema.safeParse(req('ui.resize', { height: 100.5 })).success).toBe(false);
    expect(
      BridgeRequestSchema.safeParse(req('ui.error', { message: 'x'.repeat(201) })).success,
    ).toBe(false);
    expect(BridgeRequestSchema.safeParse(req('phrases.save', { phrase: '   ' })).success).toBe(
      false,
    );
    expect(
      BridgeRequestSchema.safeParse(req('phrases.save', { phrase: 'x'.repeat(201) })).success,
    ).toBe(false);
    expect(BridgeRequestSchema.safeParse(req('tts.speak', { text: 'x'.repeat(301) })).success).toBe(
      false,
    );
    expect(BridgeRequestSchema.safeParse(req('ui.ready', undefined, { id: '' })).success).toBe(
      false,
    );
    expect(
      BridgeRequestSchema.safeParse(req('ui.ready', undefined, { id: 'x'.repeat(65) })).success,
    ).toBe(false);
  });
});

describe('BridgeResponseSchema and host messages', () => {
  it('answers with data only for phrases.list, and at most 50 phrases', () => {
    const ok = { v: 1, id: 'r1', ok: true, data: { phrases: [{ phrase: 'a', meaningVi: null }] } };
    expect(BridgeResponseSchema.safeParse(ok).success).toBe(true);
    expect(BridgeResponseSchema.safeParse({ v: 1, id: 'r1', ok: true }).success).toBe(true);
    const many = Array.from({ length: 51 }, () => ({ phrase: 'a', meaningVi: null }));
    expect(
      BridgeResponseSchema.safeParse({ v: 1, id: 'r1', ok: true, data: { phrases: many } }).success,
    ).toBe(false);
    // A phrase row carries no id, no review state: nothing but what the page needs.
    expect(
      BridgeResponseSchema.safeParse({
        v: 1,
        id: 'r1',
        ok: true,
        data: { phrases: [{ phrase: 'a', meaningVi: null, inReview: true }] },
      }).success,
    ).toBe(false);
    expect(
      BridgeResponseSchema.safeParse({ v: 1, id: 'r1', ok: false, error: 'declined' }).success,
    ).toBe(true);
    expect(
      BridgeResponseSchema.safeParse({ v: 1, id: 'r1', ok: false, error: 'stack trace' }).success,
    ).toBe(false);
  });

  it('describes the three messages the host sends and the pong the runner returns', () => {
    expect(BridgeHostMessageSchema.safeParse({ v: 1, kind: 'render', html: '<p/>' }).success).toBe(
      true,
    );
    expect(BridgeHostMessageSchema.safeParse({ v: 1, kind: 'ping', n: 3 }).success).toBe(true);
    expect(
      BridgeHostMessageSchema.safeParse({
        v: 1,
        kind: 'reply',
        response: { v: 1, id: 'r1', ok: true },
      }).success,
    ).toBe(true);
    expect(
      BridgeHostMessageSchema.safeParse({
        v: 1,
        kind: 'render',
        html: 'a'.repeat(MAX_HTML_BLOCK_BYTES + 1),
      }).success,
    ).toBe(false);
    expect(BridgePongSchema.safeParse({ v: 1, kind: 'pong', n: 3 }).success).toBe(true);
    expect(BridgePongSchema.safeParse({ v: 1, kind: 'pong', n: -1 }).success).toBe(false);
  });
});
