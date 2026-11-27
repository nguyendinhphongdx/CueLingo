import { Writable } from 'node:stream';
import type { ChatStreamPart } from '@cuelingo/ai-gateway';
import type { MeetingAskPromptInput } from '@cuelingo/prompts';
import {
  MeetingAskStreamEventSchema,
  resolvePlanLimits,
  type MeetingAskStreamEvent,
} from '@cuelingo/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryDebriefRepository } from '../debrief';
import { createInMemorySessionsRepository } from '../sessions';
import { createInMemoryMeetingAssistRepository } from './meeting-assist.repository.memory';
import { createMeetingAssistService } from './meeting-assist.service';

const ALICE = 'alice';
const BOB = 'bob';
const as = (user: string) => ({ [TEST_USER_HEADER]: user });

type Ask = (
  input: MeetingAskPromptInput,
  context?: unknown,
  signal?: AbortSignal,
) => AsyncGenerator<ChatStreamPart, void, void>;

const replying = (text: string): Ask =>
  async function* () {
    yield { type: 'text_delta', text };
    yield { type: 'finish', reason: 'stop' };
  };

const events = (body: string): MeetingAskStreamEvent[] =>
  body
    .split('\n\n')
    .filter(Boolean)
    .map((frame) => MeetingAskStreamEventSchema.parse(JSON.parse(frame.split('\ndata: ')[1]!)));

describe('meeting assistant module', () => {
  let app: FastifyInstance;
  let sessions: ReturnType<typeof createInMemorySessionsRepository>;
  let repo: ReturnType<typeof createInMemoryMeetingAssistRepository>;
  let debrief: ReturnType<typeof createInMemoryDebriefRepository>;
  let inputs: MeetingAskPromptInput[];
  let reply: Ask;
  let logs: string;

  async function start(options: { enabled?: boolean; limit?: number } = {}) {
    sessions = createInMemorySessionsRepository();
    debrief = createInMemoryDebriefRepository();
    repo = createInMemoryMeetingAssistRepository({ sessions, debrief });
    inputs = [];
    logs = '';
    app = await buildTestApp({
      repos: { sessions, debrief, meetingAssist: repo },
      planLimits: resolvePlanLimits(
        options.limit === undefined ? undefined : { free: { meeting_ask_daily: options.limit } },
      ),
      logger: {
        stream: new Writable({
          write(chunk, _encoding, done) {
            logs += String(chunk);
            done();
          },
        }),
      },
      meetingAssist: {
        enabled: options.enabled ?? true,
        gateway: {
          ask(input, context, signal) {
            inputs.push(input);
            return reply(input, context, signal);
          },
        },
      },
    });
  }

  beforeEach(async () => {
    reply = replying('Đăng nhập một lần [1]');
    await start();
  });
  afterEach(() => app.close());

  async function meeting(userId: string, lines: string[] = [], title = 'Sync') {
    const session = await sessions.create(userId, { title, assistLevel: 3 });
    const ids: string[] = [];
    for (const [index, textEn] of lines.entries()) {
      const segmentId = crypto.randomUUID();
      ids.push(segmentId);
      await sessions.saveSegment({
        sessionId: session.id,
        userId,
        segmentId,
        source: 'system',
        startMs: index * 1000,
        endMs: index * 1000 + 900,
        textEn,
      });
    }
    return { id: session.id, segmentIds: ids };
  }

  const consent = (user: string, granted = true) =>
    app.inject({
      method: 'PUT',
      url: '/v1/me/meeting-assist/consent',
      headers: as(user),
      payload: { granted },
    });

  const ask = (user: string, sessionId: string, payload: object = { question: 'SSO là gì?' }) =>
    app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/questions`,
      headers: as(user),
      payload,
    });

  const used = async (user: string) =>
    (await app.inject({ method: 'GET', url: '/v1/me/usage', headers: as(user) })).json().usage
      .meeting_ask_daily.used as number;

  it('streams status, text, checked sources and done, then keeps the answer (AC2, AC11)', async () => {
    await consent(ALICE);
    const { id } = await meeting(ALICE, ['We need SSO before launch.']);
    const response = await ask(ALICE, id);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    const sent = events(response.body);
    expect(sent.map((event) => event.type)).toEqual([
      'status',
      'status',
      'text_delta',
      'sources',
      'done',
    ]);
    expect(sent[3]).toEqual({ type: 'sources', items: [{ kind: 'current_meeting' }] });
    expect(sent[4]).toMatchObject({ status: 'complete' });
    expect(repo.questions[0]).toMatchObject({
      userId: ALICE,
      sessionId: id,
      answer: 'Đăng nhập một lần',
      status: 'complete',
      promptVersion: 'meeting.ask@v1',
    });
    expect(inputs[0]!.current).toEqual(['Others: We need SSO before launch.']);
  });

  it('refuses without consent, before anything is read or counted (AC15)', async () => {
    const { id } = await meeting(ALICE);
    const response = await ask(ALICE, id);
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('MEETING_ASSIST_CONSENT_REQUIRED');
    expect(inputs).toHaveLength(0);
    expect(await used(ALICE)).toBe(0);

    await consent(ALICE);
    expect((await ask(ALICE, id)).statusCode).toBe(200);
    await consent(ALICE, false);
    expect((await ask(ALICE, id)).statusCode).toBe(403);
  });

  it('says it is off with 503 whatever is sent, while consent can still be read (AC20)', async () => {
    await app.close();
    await start({ enabled: false });
    const { id } = await meeting(ALICE);
    const response = await ask(ALICE, id, { nonsense: true });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('MEETING_ASSIST_DISABLED');
    const status = await app.inject({
      method: 'GET',
      url: '/v1/me/meeting-assist',
      headers: as(ALICE),
    });
    expect(status.json()).toEqual({ enabled: false, consent: false });
  });

  it('stops at the daily allowance with the reset time (AC19)', async () => {
    await app.close();
    await start({ limit: 1 });
    await consent(ALICE);
    const { id } = await meeting(ALICE);
    expect((await ask(ALICE, id)).statusCode).toBe(200);
    const response = await ask(ALICE, id);
    expect(response.statusCode).toBe(429);
    expect(response.json().error).toMatchObject({
      code: 'QUOTA_EXCEEDED',
      details: { metric: 'meeting_ask_daily', limit: 1, resetsAt: expect.any(String) },
    });
    expect(inputs).toHaveLength(1);
  });

  it("never reads or answers about another person's meeting (AC16)", async () => {
    await consent(ALICE);
    await consent(BOB);
    const hers = await meeting(ALICE, ['Falcon budget is secret.'], 'Falcon budget');
    const his = await meeting(BOB, ['Hello.']);
    expect((await ask(BOB, hers.id)).statusCode).toBe(404);
    expect(inputs).toHaveLength(0);

    await ask(BOB, his.id, {
      question: 'Last time, what about the Falcon budget?',
      focus: { segmentId: hers.segmentIds[0], text: 'my own words' },
    });
    expect(inputs[0]!.focus).toBe('my own words');
    expect(JSON.stringify(inputs[0])).not.toContain('secret');
  });

  it('brings in an earlier meeting of the same person and names it as a source (AC10)', async () => {
    await consent(ALICE);
    const past = await meeting(ALICE, ['The Falcon budget is 20k.'], 'Planning');
    const { id } = await meeting(ALICE);
    reply = replying('20k [1]');
    const response = await ask(ALICE, id, { question: 'Falcon budget?' });
    expect(inputs[0]!.past).toMatchObject([
      { title: 'Planning', lines: ['Others: The Falcon budget is 20k.'] },
    ]);
    expect(events(response.body).find((event) => event.type === 'sources')).toMatchObject({
      items: [{ kind: 'past_meeting', sessionId: past.id, title: 'Planning' }],
    });
  });

  it('sends the sentence pointed at and the last three answered questions (AC5, AC6)', async () => {
    await consent(ALICE);
    const { id, segmentIds } = await meeting(ALICE, ['We ship on Friday.']);
    for (const question of ['q1', 'q2', 'q3', 'q4']) await ask(ALICE, id, { question });
    await ask(ALICE, id, {
      question: 'Giải thích câu này',
      focus: { segmentId: segmentIds[0], text: 'half heard' },
    });
    const last = inputs.at(-1)!;
    expect(last.focus).toBe('We ship on Friday.');
    expect(last.history.map((item) => item.question)).toEqual(['q2', 'q3', 'q4']);
  });

  it('reports a provider failure in the stream and lets the person ask again (AC14)', async () => {
    await consent(ALICE);
    const { id } = await meeting(ALICE);
    reply = async function* () {
      yield { type: 'text_delta', text: 'nửa' };
      throw new Error('provider down: SECRET-DETAIL');
    };
    const sent = events((await ask(ALICE, id)).body);
    expect(sent.slice(-2)).toMatchObject([
      { type: 'error', code: 'MEETING_ASSIST_FAILED' },
      { type: 'done', status: 'error' },
    ]);
    expect(repo.questions[0]!.status).toBe('error');
    expect(logs).not.toContain('SECRET-DETAIL');
    reply = replying('ok');
    expect((await ask(ALICE, id)).statusCode).toBe(200);
  });

  it('allows one question at a time and keeps the partial answer when the reader leaves (AC4)', async () => {
    // The service itself: `inject` cannot hang up in the middle of a stream.
    const service = createMeetingAssistService({
      enabled: true,
      gateway: { ask: (input, context, signal) => reply(input, context, signal) },
      repo,
      sessions,
      usage: { reserve: vi.fn() },
      listGlossary: async () => [],
      listPhrases: async () => [],
    });
    await service.setConsent(ALICE, true);
    const { id } = await meeting(ALICE);
    reply = async function* (_input, _context, signal) {
      yield { type: 'text_delta', text: 'một nửa [1]' };
      await new Promise<void>((resolve) => signal!.addEventListener('abort', () => resolve()));
    };
    const stream = await service.ask(ALICE, id, { question: 'SSO?' });
    let received = '';
    stream.on('data', (chunk) => (received += String(chunk)));
    await vi.waitFor(() => expect(received).toContain('text_delta'));
    await expect(service.ask(ALICE, id, { question: 'again' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    // Saving is held back: asking again right after Stop must not wait for it.
    let save = () => {};
    const saving = new Promise<void>((resolve) => (save = resolve));
    const finishQuestion = repo.finishQuestion.bind(repo);
    repo.finishQuestion = async (...args) => {
      await saving;
      await finishQuestion(...args);
    };
    stream.destroy();
    await new Promise((resolve) => setImmediate(resolve));
    reply = replying('ok');
    await expect(service.ask(ALICE, id, { question: 'again' })).resolves.toBeDefined();
    save();
    await vi.waitFor(() => expect(repo.questions[0]!.status).toBe('stopped'));
    expect(repo.questions[0]!.answer).toBe('một nửa');
  });

  it('does not pick an earlier meeting for matching a field name of its debrief (AC10)', async () => {
    await consent(ALICE);
    const past = await meeting(ALICE, ['Lunch was good.'], 'Social');
    debrief.seed(ALICE, {
      id: crypto.randomUUID(),
      sessionId: past.id,
      version: 1,
      createdAt: new Date().toISOString(),
      summary: { headlineVi: 'Ăn trưa', bulletsVi: [] },
      actionItems: [{ textVi: 'Đặt bàn', kind: 'decision' }],
      hardSegmentIds: [],
      phraseSuggestions: [],
      rephrase: [],
      comprehensionPct: null,
    });
    const { id } = await meeting(ALICE);
    await ask(ALICE, id, { question: 'Last time, what was the decision about SSO?' });
    expect(inputs[0]!.past).toEqual([]);
  });

  it('logs no question, answer or transcript (AC18)', async () => {
    await consent(ALICE);
    const { id } = await meeting(ALICE, ['SECRET-TRANSCRIPT line']);
    reply = replying('SECRET-ANSWER');
    await ask(ALICE, id, { question: 'SECRET-QUESTION?' });
    expect(logs).toContain('meeting question context ready');
    expect(logs).not.toMatch(/SECRET-/);
  });

  it('validates the body', async () => {
    await consent(ALICE);
    const { id } = await meeting(ALICE);
    for (const payload of [{}, { question: ' ' }, { question: 'a'.repeat(501) }]) {
      expect((await ask(ALICE, id, payload)).statusCode).toBe(400);
    }
  });
});
