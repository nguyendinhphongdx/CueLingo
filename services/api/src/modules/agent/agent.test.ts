import type { AiGateway, ChatMessage, ChatStreamPart } from '@cuelingo/ai-gateway';
import type { AgentStreamEvent } from '@cuelingo/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryConversationsRepository } from '../conversations';
import { createInMemoryPhrasesRepository } from '../review';
import { createInMemoryAgentRepository } from './index';

const ALICE = 'alice';
const BOB = 'bob';
const as = (user: string) => ({ [TEST_USER_HEADER]: user });
const ORIGIN = 'http://localhost:3000';

type Step =
  | ChatStreamPart[]
  | ((input: { messages: ChatMessage[]; signal?: AbortSignal }) => AsyncIterable<ChatStreamPart>);

const text = (...deltas: string[]): ChatStreamPart[] => [
  ...deltas.map((delta): ChatStreamPart => ({ type: 'text_delta', text: delta })),
  { type: 'finish', reason: 'stop', inputTokens: 100, outputTokens: 20 },
];
const call = (name: string, input: unknown): ChatStreamPart[] => [
  { type: 'tool_call', call: { id: 'x', name, input } },
  { type: 'finish', reason: 'tool_calls', inputTokens: 100, outputTokens: 10 },
];

/** A gateway whose `chat` plays one scripted step per call and remembers what it was sent. */
function scriptedGateway(steps: Step[]) {
  const seen: Array<{ messages: ChatMessage[]; userId?: string }> = [];
  const gateway: Pick<AiGateway, 'chat'> = {
    chat(input, context) {
      seen.push({ messages: structuredClone(input.messages), userId: context?.userId });
      const step = steps[seen.length - 1] ?? steps[steps.length - 1]!;
      return (async function* () {
        if (typeof step === 'function') yield* step(input);
        else yield* step;
      })();
    },
  };
  return { gateway, seen };
}

/** Resolves when `signal` aborts; lets a fake model hang like a slow provider until the user stops. */
const untilAborted = (signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) resolve();
    signal?.addEventListener('abort', () => resolve(), { once: true });
  });

function parseSse(body: string): Array<{ event: string; data: AgentStreamEvent }> {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n');
      return {
        event: lines.find((line) => line.startsWith('event: '))!.slice('event: '.length),
        data: JSON.parse(lines.find((line) => line.startsWith('data: '))!.slice('data: '.length)),
      };
    });
}

async function settled<T>(read: () => Promise<T | undefined | false>): Promise<T> {
  for (let i = 0; i < 200; i += 1) {
    const value = await read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('condition not met in time');
}

describe('agent module', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function setup(
    steps: Step[],
    options: {
      enabled?: boolean;
      quota?: { turns?: number; tokens?: number; costUsd?: number };
      assist?: boolean;
      logger?: { level: string; stream: { write(line: string): void } };
    } = {},
  ) {
    const conversations = createInMemoryConversationsRepository();
    const usage = createInMemoryAgentRepository();
    const phrases = createInMemoryPhrasesRepository();
    const { gateway, seen } = scriptedGateway(steps);
    const built = await buildTestApp({
      repos: { conversations, agent: usage, phrases },
      agent: { enabled: options.enabled ?? true, gateway, quota: options.quota },
      assist: options.assist
        ? {
            gateway: {
              json: (async () => ({
                term: 'circle back',
                meaningVi: 'quay lại bàn sau',
                exampleEn: "Let's circle back.",
              })) as unknown as AiGateway['json'],
            },
          }
        : undefined,
      logger: options.logger as never,
    });
    app = built;
    const create = async (user = ALICE) =>
      (
        await built.inject({
          method: 'POST',
          url: '/v1/conversations',
          headers: as(user),
          payload: {},
        })
      ).json().id as string;
    const send = (id: string, content: string, user = ALICE, extra: object = {}) =>
      built.inject({
        method: 'POST',
        url: `/v1/conversations/${id}/messages`,
        headers: { ...as(user), origin: ORIGIN },
        payload: { content, ...extra },
      });
    const detail = async (id: string, user = ALICE) =>
      (
        await built.inject({ method: 'GET', url: `/v1/conversations/${id}`, headers: as(user) })
      ).json();
    return { app: built, conversations, usage, phrases, seen, create, send, detail };
  }

  it('streams thinking, then text, then done, with the headers a proxy needs (AC1)', async () => {
    const t = await setup([text('Xin ', 'chào!')]);
    const id = await t.create();
    const res = await t.send(id, 'Hello');

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/event-stream; charset=utf-8');
    expect(res.headers['cache-control']).toBe('no-cache, no-transform');
    expect(res.headers['x-accel-buffering']).toBe('no');
    expect(res.headers['content-encoding']).toBeUndefined();
    // CORS still runs on the stream: the browser can read it from the web origin.
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');

    const events = parseSse(res.body);
    expect(events.map((e) => e.event)).toEqual(['status', 'text_delta', 'text_delta', 'done']);
    expect(events[0]!.data).toEqual({ type: 'status', status: 'thinking' });
    expect(events[1]!.data).toEqual({ type: 'text_delta', text: 'Xin ' });
    expect(events.at(-1)!.data).toEqual({ type: 'done', status: 'complete' });
    expect(res.body).toContain('event: status\ndata: {"type":"status","status":"thinking"}\n\n');

    const stored = await t.detail(id);
    expect(
      stored.messages.map((m: { role: string; status: string }) => [m.role, m.status]),
    ).toEqual([
      ['user', 'complete'],
      ['assistant', 'complete'],
    ]);
    expect(stored.messages[1].parts).toEqual([{ type: 'text', text: 'Xin chào!' }]);
  });

  it('stores the user message before the model answers and updates the assistant message as it goes (AC13)', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const t = await setup([
      async function* () {
        yield { type: 'text_delta', text: 'partial' } as ChatStreamPart;
        await gate;
        yield { type: 'finish', reason: 'stop' } as ChatStreamPart;
      },
    ]);
    const id = await t.create();
    const pending = t.send(id, 'Question');

    const during = await settled(async () => {
      const d = await t.detail(id);
      return d.messages.length === 2 ? d : false;
    });
    expect(during.messages[0]).toMatchObject({ role: 'user', status: 'complete' });
    expect(during.messages[1]).toMatchObject({ role: 'assistant', status: 'streaming' });
    release();
    await pending;
    expect((await t.detail(id)).messages[1].status).toBe('complete');
  });

  it('keeps the text and stores `stopped` when the client goes away (AC2)', async () => {
    const t = await setup([
      async function* ({ signal }) {
        yield { type: 'text_delta', text: 'Half an ans' } as ChatStreamPart;
        await untilAborted(signal);
      },
      text('Back again.'),
    ]);
    const id = await t.create();
    // `payloadAsStream` hands back the response as soon as the headers are out, like a browser would see it.
    const response = await t.app.inject({
      method: 'POST',
      url: `/v1/conversations/${id}/messages`,
      headers: as(ALICE),
      payload: { content: 'Tell me a lot' },
      payloadAsStream: true,
    });
    const chunks = response.stream()[Symbol.asyncIterator]();
    let received = '';
    while (!received.includes('Half an ans')) {
      received += String((await chunks.next()).value);
    }
    // The connection closing is what the server sees when the user presses Stop or closes the tab.
    response.raw.res.destroy();

    const stopped = await settled(async () => {
      const m = (await t.detail(id)).messages[1];
      return m.status === 'stopped' ? m : false;
    });
    expect(stopped.parts).toEqual([{ type: 'text', text: 'Half an ans' }]);
    // The conversation is free again: the lock went with the turn.
    const next = await t.send(id, 'Again');
    expect(next.statusCode).toBe(200);
  });

  it('answers 409 while a turn of the same user is running, in any conversation', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const t = await setup([
      async function* () {
        await gate;
        yield* text('late');
      },
    ]);
    const id = await t.create();
    const other = await t.create();
    const first = t.send(id, 'one');
    await settled(async () => (await t.detail(id)).messages.length === 2);

    const busy = await t.send(id, 'two');
    expect(busy.statusCode).toBe(409);
    expect(busy.json().error.code).toBe('CONFLICT');
    expect((await t.detail(id)).messages).toHaveLength(2);
    expect((await t.send(other, 'hello')).statusCode).toBe(409);

    release();
    expect((await first).statusCode).toBe(200);
    expect((await t.send(id, 'three')).statusCode).toBe(200);
    expect((await t.send(other, 'hello')).statusCode).toBe(200);
  });

  it('lets only one turn per user run at a time, so parallel conversations cannot beat the quota', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const t = await setup(
      [
        async function* () {
          await gate;
          yield* text('late');
        },
      ],
      { quota: { turns: 1 } },
    );
    const a = await t.create();
    const b = await t.create();
    const results = [t.send(a, 'one'), t.send(b, 'two')];
    // The loser answers at once; the winner waits for the gate.
    const loser = await Promise.race(results.map((r, i) => r.then((res) => ({ res, i }))));
    release();
    const all = await Promise.all(results);
    const codes = all.map((r) => r.statusCode).sort();
    expect(codes).toEqual([200, 409]);
    expect(loser.res.statusCode).toBe(409);
    expect(t.seen).toHaveLength(1);
    const stored = (await t.detail(a)).messages.length + (await t.detail(b)).messages.length;
    expect(stored).toBe(2); // one user message and one assistant message, never two turns
    // Another user is not blocked.
    expect((await t.send(await t.create(BOB), 'hi', BOB)).statusCode).toBe(200);
  });

  describe('quota (AC15)', () => {
    it('refuses with 429 before streaming when the daily cost is used up, and stores nothing', async () => {
      const t = await setup([text('never')], { quota: { costUsd: 0.25 } });
      t.usage.record(ALICE, { tokens: 1_000, costUsd: 0.26 });
      const id = await t.create();

      const res = await t.send(id, 'Hello');
      expect(res.statusCode).toBe(429);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.json().error.code).toBe('AGENT_QUOTA_EXCEEDED');
      expect(res.json().error.details.costUsd).toEqual({ used: 0.26, limit: 0.25 });
      expect(t.seen).toHaveLength(0);
      expect((await t.detail(id)).messages).toEqual([]);
      // Someone else's allowance is their own.
      const bobConversation = await t.create(BOB);
      expect((await t.send(bobConversation, 'Hi', BOB)).statusCode).toBe(200);
    });

    it('refuses when the tokens or the number of turns of the day are used up', async () => {
      const tokens = await setup([text('x')], { quota: { tokens: 400_000 } });
      tokens.usage.record(ALICE, { tokens: 400_000, costUsd: 0 });
      expect((await tokens.send(await tokens.create(), 'Hello')).statusCode).toBe(429);
      await app?.close();

      const turns = await setup([text('x')], { quota: { turns: 2 } });
      const id = await turns.create();
      expect((await turns.send(id, 'one')).statusCode).toBe(200);
      expect((await turns.send(id, 'two')).statusCode).toBe(200);
      const third = await turns.send(id, 'three');
      expect(third.statusCode).toBe(429);
      expect(third.json().error.details.turns).toEqual({ used: 2, limit: 2 });
    });

    it('ends the turn as `limited` when the allowance runs out between two steps', async () => {
      const t = await setup(
        [
          [
            { type: 'text_delta', text: 'Checking. ' },
            { type: 'tool_call', call: { id: 'a', name: 'list_saved_phrases', input: {} } },
            { type: 'finish', reason: 'tool_calls', inputTokens: 300, outputTokens: 200 },
          ],
          text('should not be asked'),
        ],
        { quota: { tokens: 400 } },
      );
      const id = await t.create();
      const events = parseSse((await t.send(id, 'Hello')).body);

      expect(events.at(-1)!.data).toEqual({ type: 'done', status: 'limited' });
      expect(t.seen).toHaveLength(1);
      const stored = await t.detail(id);
      expect(stored.messages[1].status).toBe('limited');
    });
  });

  it('answers 503 AGENT_DISABLED when the assistant is off', async () => {
    const t = await setup([text('x')], { enabled: false });
    const id = await t.create();
    const res = await t.send(id, 'Hello');
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('AGENT_DISABLED');
    expect(t.seen).toHaveLength(0);
    expect((await t.detail(id)).messages).toEqual([]);
  });

  it('runs tools: saves a phrase only for the caller, then answers (AC3)', async () => {
    const t = await setup(
      [
        call('save_phrase', {
          phrase: 'Circle Back',
          meaningVi: 'quay lại bàn sau',
          context: "Let's circle back on Friday.",
        }),
        text('Đã lưu rồi nhé.'),
      ],
      { assist: true },
    );
    const id = await t.create();
    const events = parseSse((await t.send(id, 'Lưu "circle back" giúp mình')).body).map(
      (e) => e.data,
    );

    expect(events.map((e) => e.type)).toEqual([
      'status',
      'tool_call',
      'tool_result',
      'status',
      'text_delta',
      'done',
    ]);
    expect(events[1]).toMatchObject({ type: 'tool_call', callId: 's0c0', tool: 'save_phrase' });
    expect(events[2]).toEqual({
      type: 'tool_result',
      callId: 's0c0',
      tool: 'save_phrase',
      ok: true,
      summary: 'Đã lưu "circle back" vào Phrase Bank',
    });

    const alicePhrases = await t.phrases.list(ALICE, 'en');
    expect(alicePhrases).toMatchObject([
      { phrase: 'circle back', meaningVi: 'quay lại bàn sau', inReview: true },
    ]);
    expect(t.phrases.contextOf(ALICE, alicePhrases[0]!.id)).toBe("Let's circle back on Friday.");
    expect(await t.phrases.list(BOB, 'en')).toEqual([]);

    // The second model step was told the result, and the stored message shows the same step.
    const resultMessage = t.seen[1]!.messages.find((m) => m.role === 'tool')!;
    expect(resultMessage).toMatchObject({ name: 'save_phrase' });
    const stored = (await t.detail(id)).messages[1];
    expect(stored.parts[0]).toMatchObject({ type: 'tool_step', tool: 'save_phrase', status: 'ok' });
    expect(t.seen.every((s) => s.userId === ALICE)).toBe(true);
  });

  it('lists only the caller phrases and never shows another user to the model', async () => {
    const t = await setup([call('list_saved_phrases', {}), text('Bạn đã lưu một cụm.')]);
    await t.phrases.save(ALICE, { phrase: 'touch base' });
    await t.phrases.save(BOB, { phrase: 'secret bob phrase' });
    const id = await t.create();
    await t.send(id, 'Mình đã lưu gì?');

    const toolResult = t.seen[1]!.messages.find((m) => m.role === 'tool')!;
    expect(toolResult.content).toContain('touch base');
    expect(toolResult.content).not.toContain('secret bob phrase');
  });

  it('looks a word up through the Quick Assist service', async () => {
    const t = await setup(
      [call('lookup_word', { term: 'circle back' }), text('Nghĩa là quay lại.')],
      {
        assist: true,
      },
    );
    const id = await t.create();
    const events = parseSse((await t.send(id, 'circle back là gì?')).body).map((e) => e.data);
    expect(events[2]).toMatchObject({ type: 'tool_result', tool: 'lookup_word', ok: true });
    expect(t.seen[1]!.messages.find((m) => m.role === 'tool')!.content).toContain(
      'quay lại bàn sau',
    );
  });

  it('shows a valid card and tells the model what is wrong with an invalid one', async () => {
    const t = await setup([
      call('show_card', {
        kind: 'flashcards',
        data: { title: 'Họp', cards: [{ front: 'agenda', back: 'chương trình họp' }] },
      }),
      call('show_card', {
        kind: 'quiz_choice',
        data: { question: 'Q', options: ['a', 'b'], answerIndex: 5 },
      }),
      text('Xong.'),
    ]);
    const id = await t.create();
    const events = parseSse((await t.send(id, 'Cho mình thẻ')).body).map((e) => e.data);

    const cards = events.filter((e) => e.type === 'card');
    expect(cards).toEqual([
      {
        type: 'card',
        card: {
          kind: 'flashcards',
          data: { title: 'Họp', cards: [{ front: 'agenda', back: 'chương trình họp' }] },
        },
      },
    ]);
    const results = events.filter((e) => e.type === 'tool_result');
    expect(results[1]).toMatchObject({ ok: true, summary: 'Thẻ chưa hợp lệ, đã bỏ qua' });
    expect(t.seen[2]!.messages.filter((m) => m.role === 'tool')[1]!.content).toContain(
      'answerIndex',
    );
    const stored = (await t.detail(id)).messages[1];
    expect(stored.parts.filter((p: { type: string }) => p.type === 'card')).toHaveLength(1);
  });

  it('creates an exercise card from the caller saved phrases only (AC16)', async () => {
    const t = await setup([
      call('create_exercise', { kind: 'cloze', source: 'saved_phrases' }),
      text('Làm thử nhé.'),
    ]);
    await t.phrases.save(ALICE, {
      phrase: 'circle back',
      meaningVi: 'quay lại bàn sau',
      language: 'en',
    });
    await t.phrases.save(BOB, {
      phrase: 'secret bob phrase',
      meaningVi: 'của Bob',
      language: 'en',
    });
    const id = await t.create();
    const events = parseSse((await t.send(id, 'Cho mình bài tập')).body).map((e) => e.data);

    expect(t.seen[0]).toBeDefined();
    const card = events.find((e) => e.type === 'card');
    expect(card).toMatchObject({
      card: { kind: 'cloze', data: { items: [{ answer: 'circle back' }] } },
    });
    expect(JSON.stringify(events)).not.toContain('secret bob phrase');
    expect(events.find((e) => e.type === 'tool_result')).toMatchObject({
      tool: 'create_exercise',
      ok: true,
      summary: 'Đã tạo bài tập',
    });
  });

  it('lets the second turn see the first (AC5)', async () => {
    const t = await setup([
      text('Circle back nghĩa là quay lại.'),
      text('Ví dụ: Let us circle back.'),
    ]);
    const id = await t.create();
    await t.send(id, 'circle back là gì?');
    await t.send(id, 'Cho ví dụ');

    expect(t.seen[1]!.messages).toEqual([
      { role: 'user', content: 'circle back là gì?' },
      { role: 'assistant', content: 'Circle back nghĩa là quay lại.' },
      { role: 'user', content: 'Cho ví dụ' },
    ]);
  });

  it('turns a provider failure into AGENT_FAILED without leaking its message (AC4)', async () => {
    const t = await setup([
      async function* () {
        throw new Error('quota exceeded for key AIza-SECRET at generativelanguage.googleapis.com');
        yield { type: 'finish', reason: 'stop' } as ChatStreamPart;
      },
    ]);
    const id = await t.create();
    const res = await t.send(id, 'Hello');

    expect(res.statusCode).toBe(200);
    expect(parseSse(res.body).map((e) => e.data)).toEqual([
      { type: 'status', status: 'thinking' },
      { type: 'error', code: 'AGENT_FAILED' },
      { type: 'done', status: 'error' },
    ]);
    expect(res.body).not.toContain('AIza-SECRET');
    expect((await t.detail(id)).messages[1].status).toBe('error');
  });

  it('does not let another user send into or read a conversation, and the model is never called', async () => {
    const t = await setup([text('x')]);
    const id = await t.create(ALICE);
    const res = await t.send(id, 'Let me in', BOB);

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
    expect(t.seen).toHaveLength(0);
    expect((await t.detail(id, ALICE)).messages).toEqual([]);
  });

  it('validates the request and requires a session', async () => {
    const t = await setup([text('x')]);
    const id = await t.create();
    expect((await t.send(id, '   ')).statusCode).toBe(400);
    expect((await t.send(id, 'x'.repeat(4001))).statusCode).toBe(400);
    expect((await t.send(id, 'hi', ALICE, { userId: 'bob' })).statusCode).toBe(400);
    expect((await t.send('not-a-uuid', 'hi')).statusCode).toBe(400);
    const anonymous = await t.app.inject({
      method: 'POST',
      url: `/v1/conversations/${id}/messages`,
      payload: { content: 'hi' },
    });
    expect(anonymous.statusCode).toBe(401);
  });

  it('keeps message text out of the logs', async () => {
    const lines: string[] = [];
    const t = await setup([text('An answer with ZEBRA-ANSWER')], {
      logger: { level: 'info', stream: { write: (line) => void lines.push(line) } },
    });
    const id = await t.create();
    await t.send(id, 'A question with ZEBRA-SECRET');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join('')).not.toContain('ZEBRA');
  });
});
