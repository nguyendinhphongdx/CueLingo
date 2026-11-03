import type { AiGateway, LlmResult } from '@cuelingo/ai-gateway';
import {
  ServerMessageSchema,
  type SegmentFinalMessage,
  type ServerMessage,
} from '@cuelingo/shared';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeDeps } from './realtime.service';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';

const SESSION_ID = '9ee72a14-8cd4-4f2e-8131-4ed638e2d875';
const SEGMENT_IDS = [
  'c67ef96d-7890-49a7-9a55-66c49272e38f',
  '34ac6374-b84a-4491-8873-2906a1b60186',
  '19a0565f-5ba9-4483-9087-701fefb180c3',
  'a405c258-0487-4ad9-be00-c1d8ee9ba840',
];
const USER_ID = 'alice';
const VALID_TOKEN = 'valid-token';

const result = (text: string): LlmResult => ({
  text,
  model: 'fake-model',
  fallback: false,
  latencyMs: 1,
});

const segment = (
  text: string,
  index = 0,
  stream: SegmentFinalMessage['stream'] = 'system',
): SegmentFinalMessage => ({
  type: 'segment.final',
  segmentId: SEGMENT_IDS[index]!,
  stream,
  startMs: index * 1_000,
  endMs: index * 1_000 + 900,
  text,
  words: [],
});

function nextMessage(socket: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve) => {
    socket.once('message', (data) =>
      resolve(ServerMessageSchema.parse(JSON.parse(data.toString()))),
    );
  });
}

function collectMessages(socket: WebSocket, count: number): Promise<ServerMessage[]> {
  return new Promise((resolve) => {
    const messages: ServerMessage[] = [];
    socket.on('message', (data) => {
      messages.push(ServerMessageSchema.parse(JSON.parse(data.toString())));
      if (messages.length === count) resolve(messages);
    });
  });
}

describe('realtime module', () => {
  let app: FastifyInstance;
  let socket: WebSocket;
  let llm: ReturnType<typeof vi.fn<AiGateway['llm']>>;
  let deps: RealtimeDeps;

  beforeEach(async () => {
    llm = vi.fn(async (_task, input) => result(`vi:${input.text}`));
    deps = {
      gateway: { llm },
      verifyToken: vi.fn(async (token) => (token === VALID_TOKEN ? USER_ID : null)),
      glossary: vi.fn(async () => [{ term: 'SLA', translation: 'cam kết dịch vụ' }]),
    };
    app = await buildTestApp({ realtime: deps });
    await app.ready();
  });

  afterEach(async () => {
    socket?.terminate();
    await app.close();
  });

  async function connect() {
    socket = await app.injectWS(`/v1/sessions/${SESSION_ID}/stream`);
    return socket;
  }

  async function authenticate(token = VALID_TOKEN) {
    const response = nextMessage(socket);
    socket.send(
      JSON.stringify({
        type: 'hello',
        sessionId: SESSION_ID,
        token,
        sttSource: 'local',
        assistLevel: 3,
      }),
    );
    return response;
  }

  it('sends ready for a valid hello', async () => {
    await connect();
    await expect(authenticate()).resolves.toEqual({ type: 'ready', sessionId: SESSION_ID });
  });

  it('sends a non-retryable unauthorized error and closes for a bad token', async () => {
    await connect();
    const closed = new Promise<void>((resolve) => socket.once('close', () => resolve()));

    await expect(authenticate('bad-token')).resolves.toEqual({
      type: 'error',
      code: 'ws_unauthorized',
      retryable: false,
    });
    await closed;
  });

  it('rejects a bad message without closing the connection', async () => {
    await connect();
    const error = nextMessage(socket);
    socket.send(JSON.stringify({ type: 'unknown' }));
    await expect(error).resolves.toEqual({
      type: 'error',
      code: 'ws_bad_message',
      retryable: false,
    });

    await expect(authenticate()).resolves.toEqual({ type: 'ready', sessionId: SESSION_ID });
  });

  it('translates system segments with the user glossary and three previous system sentences', async () => {
    await connect();
    await authenticate();
    const texts = ['one', 'two', 'three', 'four'];

    for (const [index, text] of texts.entries()) {
      const response = nextMessage(socket);
      socket.send(JSON.stringify(segment(text, index)));
      await expect(response).resolves.toMatchObject({
        type: 'translation',
        segmentId: SEGMENT_IDS[index],
        textVi: `vi:${text}`,
        hardWords: [],
      });
    }

    expect(llm).toHaveBeenLastCalledWith(
      'translate.realtime',
      {
        text: 'four',
        previous: ['one', 'two', 'three'],
        glossary: [{ term: 'SLA', translation: 'cam kết dịch vụ' }],
        language: 'en',
      },
      expect.objectContaining({ userId: USER_ID }),
    );
    expect(deps.glossary).toHaveBeenCalledWith(USER_ID, 'en');
  });

  it('does not translate mic segments or include them in system context', async () => {
    await connect();
    await authenticate();
    socket.send(JSON.stringify(segment('my voice', 0, 'mic')));

    const response = nextMessage(socket);
    socket.send(JSON.stringify(segment('their voice', 1)));
    await response;

    expect(llm).toHaveBeenCalledTimes(1);
    expect(llm).toHaveBeenCalledWith(
      'translate.realtime',
      expect.objectContaining({
        text: 'their voice',
        previous: [],
      }),
      expect.objectContaining({ userId: USER_ID }),
    );
  });

  it.each([
    ['ja', '検討します'],
    ['ko', '검토해 보겠습니다'],
    ['zh', '我们会研究一下'],
  ] as const)(
    "translates and looks up the glossary in the meeting's own language (%s)",
    async (language, text) => {
      const saveSegment = vi.fn(async () => true);
      deps.store = {
        saveSegment,
        saveTranslation: vi.fn(async () => undefined),
        findById: vi.fn(async () => ({ language }) as never),
      };
      await connect();
      await authenticate();

      const response = nextMessage(socket);
      socket.send(JSON.stringify(segment(text, 0)));
      await response;

      expect(saveSegment).toHaveBeenCalledWith(expect.objectContaining({ language }));
      expect(llm).toHaveBeenLastCalledWith(
        'translate.realtime',
        expect.objectContaining({ language }),
        expect.anything(),
      );
      expect(deps.glossary).toHaveBeenCalledWith(USER_ID, language);
    },
  );

  it('stores a Vietnamese system segment but never translates it', async () => {
    const saveSegment = vi.fn(async () => true);
    const saveTranslation = vi.fn(async () => undefined);
    deps.store = {
      saveSegment,
      saveTranslation,
      findById: vi.fn(async () => ({ language: 'vi' }) as never),
    };
    await connect();
    await authenticate();
    const received: ServerMessage[] = [];
    socket.on('message', (data) =>
      received.push(ServerMessageSchema.parse(JSON.parse(data.toString()))),
    );

    socket.send(JSON.stringify(segment('Chúng ta sẽ phát hành vào thứ Sáu.', 0)));
    socket.send(JSON.stringify(segment('Em sẽ chuẩn bị ghi chú.', 1, 'mic')));
    await vi.waitFor(() => expect(saveSegment).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(saveSegment).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'system', language: 'vi' }),
    );
    expect(llm).not.toHaveBeenCalled();
    expect(deps.glossary).not.toHaveBeenCalled();
    expect(saveTranslation).not.toHaveBeenCalled();
    expect(received).toEqual([]);
  });

  it('follows a language change made over REST when told to re-read the session', async () => {
    let language: 'en' | 'ja' = 'en';
    deps.store = {
      saveSegment: vi.fn(async () => true),
      saveTranslation: vi.fn(async () => undefined),
      findById: vi.fn(async () => ({ language }) as never),
    };
    await connect();
    await authenticate();
    language = 'ja';
    socket.send(JSON.stringify({ type: 'language.set' }));

    const response = nextMessage(socket);
    socket.send(JSON.stringify(segment('検討します', 0)));
    await response;

    expect(llm).toHaveBeenLastCalledWith(
      'translate.realtime',
      expect.objectContaining({ language: 'ja' }),
      expect.anything(),
    );
  });

  it('stores final mic and system segments, then stores the system translation', async () => {
    const saveSegment = vi.fn(async () => true);
    const saveTranslation = vi.fn(async () => undefined);
    deps.store = { saveSegment, saveTranslation, findById: vi.fn(async () => null) };
    await connect();
    await authenticate();

    socket.send(JSON.stringify(segment('my voice', 0, 'mic')));
    const response = nextMessage(socket);
    socket.send(JSON.stringify(segment('their voice', 1)));
    await response;

    await vi.waitFor(() => expect(saveSegment).toHaveBeenCalledTimes(2));
    await vi.waitFor(() =>
      expect(saveTranslation).toHaveBeenCalledWith(SEGMENT_IDS[1], 'vi:their voice'),
    );
    expect(saveSegment).toHaveBeenNthCalledWith(1, {
      sessionId: SESSION_ID,
      userId: USER_ID,
      segmentId: SEGMENT_IDS[0],
      source: 'mic',
      startMs: 0,
      endMs: 900,
      textEn: 'my voice',
      language: 'en',
    });
  });

  it('keeps translating when segment and translation persistence fail', async () => {
    const saveSegment = vi
      .fn(async () => true)
      .mockRejectedValueOnce(new Error('segment write failed'))
      .mockResolvedValueOnce(true);
    const saveTranslation = vi.fn(async () => {
      throw new Error('translation write failed');
    });
    deps.store = { saveSegment, saveTranslation, findById: vi.fn(async () => null) };
    await connect();
    await authenticate();

    let response = nextMessage(socket);
    socket.send(JSON.stringify(segment('first')));
    await expect(response).resolves.toMatchObject({ type: 'translation', textVi: 'vi:first' });

    response = nextMessage(socket);
    socket.send(JSON.stringify(segment('second', 1)));
    await expect(response).resolves.toMatchObject({ type: 'translation', textVi: 'vi:second' });
    await vi.waitFor(() => expect(saveTranslation).toHaveBeenCalledTimes(1));
  });

  it('does not store translations when the session is missing or belongs to another user', async () => {
    const saveSegment = vi.fn(async () => false);
    const saveTranslation = vi.fn(async () => undefined);
    deps.store = { saveSegment, saveTranslation, findById: vi.fn(async () => null) };
    await connect();
    await authenticate();

    const response = nextMessage(socket);
    socket.send(JSON.stringify(segment('still translate')));
    await expect(response).resolves.toMatchObject({
      type: 'translation',
      textVi: 'vi:still translate',
    });
    await vi.waitFor(() => expect(saveSegment).toHaveBeenCalledOnce());
    expect(saveTranslation).not.toHaveBeenCalled();
  });

  it('reports a retryable translation error and translates later segments', async () => {
    llm.mockRejectedValueOnce(new Error('provider failed'));
    await connect();
    await authenticate();

    let response = nextMessage(socket);
    socket.send(JSON.stringify(segment('first')));
    await expect(response).resolves.toEqual({
      type: 'error',
      code: 'ws_translation_failed',
      retryable: true,
    });

    response = nextMessage(socket);
    socket.send(JSON.stringify(segment('second', 1)));
    await expect(response).resolves.toMatchObject({
      type: 'translation',
      segmentId: SEGMENT_IDS[1],
      textVi: 'vi:second',
    });
  });

  it('returns translations in the same order as received segments', async () => {
    let finishFirst: (value: LlmResult) => void = () => undefined;
    llm.mockImplementationOnce(() => new Promise<LlmResult>((resolve) => (finishFirst = resolve)));
    await connect();
    await authenticate();
    const responses = collectMessages(socket, 2);

    socket.send(JSON.stringify(segment('slow first')));
    socket.send(JSON.stringify(segment('fast second', 1)));
    await vi.waitFor(() => expect(llm).toHaveBeenCalledTimes(1));
    finishFirst(result('vi:slow first'));

    await expect(responses).resolves.toMatchObject([
      { type: 'translation', segmentId: SEGMENT_IDS[0] },
      { type: 'translation', segmentId: SEGMENT_IDS[1] },
    ]);
  });

  it('keeps health and existing authenticated routes unchanged', async () => {
    expect((await app.inject({ method: 'GET', url: '/healthz' })).json()).toEqual({ ok: true });
    const glossary = await app.inject({
      method: 'GET',
      url: '/v1/glossary',
      headers: { [TEST_USER_HEADER]: USER_ID },
    });
    expect(glossary.statusCode).toBe(200);
  });
});
