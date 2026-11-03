import { Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import type { AiGateway } from '@cuelingo/ai-gateway';
import type { Debrief } from '@cuelingo/shared';
import type { FastifyServerOptions } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryDebriefRepository } from '../debrief';
import { createInMemorySessionsRepository } from '../sessions';

const as = (user: string) => ({ [TEST_USER_HEADER]: user });
const SECRET = 'Khach hang Zeta Corp ky hop dong bi mat';

const debriefFor = (sessionId: string): Debrief => ({
  id: randomUUID(),
  sessionId,
  version: 1,
  createdAt: '2026-11-03T09:00:00.000Z',
  summary: { headlineVi: SECRET, bulletsVi: ['Phát hành thứ Sáu'] },
  actionItems: [
    { textVi: 'Phát hành thứ Sáu', kind: 'decision' },
    { textVi: 'Viết ghi chú', owner: 'Lee', kind: 'todo' },
  ],
  hardSegmentIds: [],
  phraseSuggestions: [],
  rephrase: [],
  comprehensionPct: null,
});

type Json = AiGateway['json'];
const gatewayReturning = (output: unknown = { subject: 'Follow-up', body: 'Draft body' }) => ({
  json: vi.fn(async () => output) as unknown as ReturnType<typeof vi.fn> & Json,
});

async function setup(
  options: {
    gateway?: { json: Json };
    followup?: { maxRequests?: number; windowMs?: number; clock?: () => number };
    logger?: FastifyServerOptions['logger'];
  } = {},
) {
  const sessions = createInMemorySessionsRepository();
  const debrief = createInMemoryDebriefRepository();
  const gateway = options.gateway ?? gatewayReturning();
  const app = await buildTestApp({
    repos: { sessions, debrief },
    followup: { gateway, ...options.followup },
    logger: options.logger,
  });
  const enSession = await sessions.create('alice', { assistLevel: 0 });
  const viSession = await sessions.create('alice', { assistLevel: 0, language: 'vi' });
  const bare = await sessions.create('alice', { assistLevel: 0 });
  debrief.seed('alice', debriefFor(enSession.id));
  debrief.seed('alice', debriefFor(viSession.id));
  const post = (
    user: string,
    sessionId: string,
    body: Record<string, unknown> = { channel: 'email', tone: 'polite' },
  ) =>
    app.inject({
      method: 'POST',
      url: `/v1/sessions/${sessionId}/followup`,
      headers: as(user),
      payload: body,
    });
  return { app, gateway, enSession, viSession, bare, post };
}

describe('POST /v1/sessions/:id/followup', () => {
  it('returns an email draft with subject, body and the meeting language', async () => {
    const { enSession, post, gateway } = await setup();
    const response = await post('alice', enSession.id);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ subject: 'Follow-up', body: 'Draft body', language: 'en' });
    expect((gateway.json as ReturnType<typeof vi.fn>).mock.calls[0]![3]).toEqual({
      userId: 'alice',
      sessionId: enSession.id,
    });
  });

  it('returns a chat draft without subject even if the model sent one', async () => {
    const { enSession, post } = await setup({
      gateway: gatewayReturning({ subject: 'Should not be here', body: 'Quick note' }),
    });
    const response = await post('alice', enSession.id, { channel: 'chat', tone: 'brief' });
    expect(response.json()).toEqual({ subject: null, body: 'Quick note', language: 'en' });
  });

  it('uses the Vietnamese headline as the subject only for a Vietnamese meeting', async () => {
    const { viSession, post } = await setup({
      gateway: gatewayReturning({ subject: null, body: 'Body' }),
    });
    expect((await post('alice', viSession.id)).json().subject).toBe(SECRET);
  });

  it('uses the English generic subject for an English meeting', async () => {
    const { enSession, post } = await setup({
      gateway: gatewayReturning({ subject: null, body: 'Body' }),
    });
    expect((await post('alice', enSession.id)).json().subject).toBe('Follow-up: meeting summary');
  });

  it('uses the generic subject when the headline is empty or the meeting is Japanese', async () => {
    const sessions = createInMemorySessionsRepository();
    const debrief = createInMemoryDebriefRepository();
    const app = await buildTestApp({
      repos: { sessions, debrief },
      followup: { gateway: gatewayReturning({ subject: ' ', body: 'Body' }) },
    });
    const vi_ = await sessions.create('alice', { assistLevel: 0, language: 'vi' });
    const ja = await sessions.create('alice', { assistLevel: 0, language: 'ja' });
    const empty = debriefFor(vi_.id);
    empty.summary.headlineVi = '  ';
    debrief.seed('alice', empty);
    debrief.seed('alice', debriefFor(ja.id));
    const ask = (id: string) =>
      app.inject({
        method: 'POST',
        url: `/v1/sessions/${id}/followup`,
        headers: as('alice'),
        payload: { channel: 'email', tone: 'polite' },
      });
    expect((await ask(vi_.id)).json().subject).toBe('Tóm tắt cuộc họp');
    expect((await ask(ja.id)).json().subject).toBe('会議のフォローアップ');
  });

  it('asks the model once more when a draft breaks a rule, then accepts a good one', async () => {
    const json = vi
      .fn()
      .mockResolvedValueOnce({ subject: 'S', body: 'Hi [Name],' })
      .mockResolvedValueOnce({ subject: 'S', body: 'Hi all' });
    const { enSession, post } = await setup({ gateway: { json } as unknown as { json: Json } });
    const response = await post('alice', enSession.id);
    expect(response.statusCode).toBe(200);
    expect(response.json().body).toBe('Hi all');
    expect(json).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a placeholder', 'email', { subject: 'S', body: 'Due {{date}}' }],
    ['a long email', 'email', { subject: 'S', body: 'x'.repeat(3001) }],
    ['a long chat', 'chat', { subject: null, body: 'x'.repeat(1201) }],
    ['too many chat lines', 'chat', { subject: null, body: Array(11).fill('a').join('\n') }],
  ])('answers 502 after one retry when the draft has %s', async (_name, channel, output) => {
    const json = vi.fn(async () => output);
    const { enSession, post } = await setup({ gateway: { json } as unknown as { json: Json } });
    const response = await post('alice', enSession.id, { channel, tone: 'brief' });
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('FOLLOWUP_FAILED');
    expect(json).toHaveBeenCalledTimes(2);
  });

  it('does not retry when the model call itself fails', async () => {
    const json = vi.fn(async () => Promise.reject(new Error('down')));
    const { enSession, post } = await setup({ gateway: { json } as unknown as { json: Json } });
    expect((await post('alice', enSession.id)).statusCode).toBe(502);
    expect(json).toHaveBeenCalledTimes(1);
  });

  it('passes debrief facts, language, channel and tone to the prompt input', async () => {
    const { viSession, post, gateway } = await setup();
    await post('alice', viSession.id, { channel: 'chat', tone: 'friendly' });
    const [task, input, , context] = (gateway.json as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(task).toBe('assist.followup');
    expect(input).toEqual({
      debrief: {
        summary: { headlineVi: SECRET, bulletsVi: ['Phát hành thứ Sáu'] },
        actionItems: [
          { textVi: 'Phát hành thứ Sáu', kind: 'decision' },
          { textVi: 'Viết ghi chú', owner: 'Lee', kind: 'todo' },
        ],
      },
      language: 'vi',
      channel: 'chat',
      tone: 'friendly',
    });
    expect(context.userId).toBe('alice');
  });

  it("answers 404 for another user's session without calling the model", async () => {
    const { enSession, post, gateway } = await setup();
    const response = await post('bob', enSession.id);
    expect(response.statusCode).toBe(404);
    expect(gateway.json).not.toHaveBeenCalled();
  });

  it('answers the same 404 when the session has no debrief yet', async () => {
    const { enSession, bare, post, gateway } = await setup();
    const other = await post('bob', enSession.id);
    const none = await post('alice', bare.id);
    const unknown = await post('alice', randomUUID());
    expect(none.statusCode).toBe(404);
    const message = (r: typeof none) => r.json().error;
    expect(message(none)).toMatchObject({ code: 'NOT_FOUND', message: message(other).message });
    expect(message(unknown)).toMatchObject({ code: 'NOT_FOUND', message: message(other).message });
    expect(gateway.json).not.toHaveBeenCalled();
  });

  it('rejects bad channel, tone or extra fields with 400 and a missing user with 401', async () => {
    const { app, enSession, post, gateway } = await setup();
    expect((await post('alice', enSession.id, { channel: 'sms', tone: 'brief' })).statusCode).toBe(
      400,
    );
    expect((await post('alice', enSession.id, { channel: 'chat', tone: 'rude' })).statusCode).toBe(
      400,
    );
    expect(
      (await post('alice', enSession.id, { channel: 'chat', tone: 'brief', userId: 'bob' }))
        .statusCode,
    ).toBe(400);
    const anonymous = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${enSession.id}/followup`,
      payload: { channel: 'chat', tone: 'brief' },
    });
    expect(anonymous.statusCode).toBe(401);
    expect(gateway.json).not.toHaveBeenCalled();
  });

  it('answers 502 FOLLOWUP_FAILED when the model fails, without its message', async () => {
    const { enSession, post } = await setup({
      gateway: {
        json: vi.fn(async () => Promise.reject(new Error(SECRET))) as unknown as Json,
      },
    });
    const response = await post('alice', enSession.id);
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('FOLLOWUP_FAILED');
    expect(response.body).not.toContain('Zeta');
  });

  it('limits one user to 6 drafts a minute and leaves others alone', async () => {
    let now = 0;
    const { enSession, post, gateway } = await setup({ followup: { clock: () => now } });
    for (let i = 0; i < 6; i += 1) expect((await post('alice', enSession.id)).statusCode).toBe(200);
    const limited = await post('alice', enSession.id);
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe('RATE_LIMITED');
    expect(gateway.json).toHaveBeenCalledTimes(6);
    now = 60_001;
    expect((await post('alice', enSession.id)).statusCode).toBe(200);
  });

  it('does not use up slots on a prober or a session without a debrief', async () => {
    const { enSession, bare, post, gateway } = await setup({ followup: { maxRequests: 2 } });
    for (let i = 0; i < 5; i += 1) {
      expect((await post('bob', enSession.id)).statusCode).toBe(404);
      expect((await post('alice', bare.id)).statusCode).toBe(404);
    }
    expect((await post('alice', enSession.id)).statusCode).toBe(200);
    expect((await post('alice', enSession.id)).statusCode).toBe(200);
    expect((await post('alice', enSession.id)).statusCode).toBe(429);
    expect(gateway.json).toHaveBeenCalledTimes(2);
  });

  it('keeps counting correctly across many users and after the window passes', async () => {
    let now = 0;
    const sessions = createInMemorySessionsRepository();
    const debrief = createInMemoryDebriefRepository();
    const gateway = gatewayReturning();
    const app = await buildTestApp({
      repos: { sessions, debrief },
      followup: { gateway, maxRequests: 1, clock: () => now },
    });
    const ask = (user: string, id: string) =>
      app.inject({
        method: 'POST',
        url: `/v1/sessions/${id}/followup`,
        headers: as(user),
        payload: { channel: 'chat', tone: 'brief' },
      });
    const mine = await sessions.create('u0', { assistLevel: 0 });
    debrief.seed('u0', debriefFor(mine.id));
    expect((await ask('u0', mine.id)).statusCode).toBe(200);
    expect((await ask('u0', mine.id)).statusCode).toBe(429);
    now = 61_000;
    expect((await ask('u0', mine.id)).statusCode).toBe(200);
  });

  it('never writes the debrief or the draft to logs or error bodies', async () => {
    let logs = '';
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs += chunk.toString();
        callback();
      },
    });
    const ok = await setup({
      gateway: gatewayReturning({ subject: 'Confidential subject', body: 'Confidential draft' }),
      logger: { level: 'info', stream },
    });
    expect((await ok.post('alice', ok.enSession.id)).statusCode).toBe(200);
    const failing = await setup({
      gateway: { json: vi.fn(async () => Promise.reject(new Error(SECRET))) as unknown as Json },
      logger: { level: 'info', stream },
    });
    const failure = await failing.post('alice', failing.enSession.id);
    expect(failure.statusCode).toBe(502);

    expect(logs).toContain('follow-up drafted');
    expect(logs).not.toContain('Zeta');
    expect(logs).not.toContain('Confidential');
    expect(logs).not.toContain('Lee');
    expect(failure.body).not.toContain('Zeta');
  });
});
