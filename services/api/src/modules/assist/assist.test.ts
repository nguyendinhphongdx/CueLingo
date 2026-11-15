import { createAiGateway, type AiGateway, type GenerateFn } from '@cuelingo/ai-gateway';
import { resolvePlanLimits } from '@cuelingo/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createAssistModule } from './index';

const USER = 'alice';

const responses = {
  'assist.lookup': {
    term: 'table',
    pos: 'verb',
    meaningVi: 'tạm hoãn thảo luận',
    exampleEn: 'Let us table this topic until Friday.',
  },
  'assist.recap': {
    summaryVi: 'Nhóm sẽ phát hành vào thứ Sáu. Lee sẽ chuẩn bị ghi chú phát hành.',
    bulletsVi: ['Chốt lịch phát hành thứ Sáu', 'Lee phụ trách ghi chú'],
  },
  'assist.compose': {
    options: [
      { en: 'Could you clarify that point, please?' },
      { en: 'Would you mind explaining that in more detail?' },
    ],
  },
} as const;

describe('assist module', () => {
  let app: FastifyInstance;
  let json: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    json = vi.fn(async (task: keyof typeof responses) => responses[task]);
    app = await buildTestApp({
      assist: { gateway: { json: json as unknown as AiGateway['json'] } },
    });
  });
  afterEach(() => app.close());

  const post = (path: string, payload: unknown, authenticated = true) =>
    app.inject({
      method: 'POST',
      url: `/v1/assist/${path}`,
      headers: authenticated ? { [TEST_USER_HEADER]: USER } : undefined,
      payload: payload as object,
    });

  it('returns a contextual Vietnamese lookup with a short example', async () => {
    const response = await post('lookup', { term: 'table', context: 'Let us table this.' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(responses['assist.lookup']);
    expect(json).toHaveBeenCalledWith(
      'assist.lookup',
      { term: 'table', context: 'Let us table this.' },
      expect.anything(),
      { userId: USER },
    );
  });

  it('returns a Vietnamese recap of at most two sentences and five bullets', async () => {
    const response = await post('recap', {
      sentences: [
        { speaker: 'Mia', text: 'We will ship Friday.' },
        { speaker: 'Lee', text: 'I will prepare the release notes.' },
      ],
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(responses['assist.recap']);
    expect(response.json().bulletsVi).toHaveLength(2);
  });

  it('returns two concise English compose options', async () => {
    const response = await post('compose', { intentVi: 'Bạn giải thích rõ hơn được không?' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(responses['assist.compose']);
    expect(response.json().options).toHaveLength(2);
  });

  it.each([
    ['lookup', { term: '' }],
    ['recap', { sentences: [] }],
    ['compose', { intentVi: '' }],
  ])('returns 400 for an invalid %s body', async (path, payload) => {
    const response = await post(path, payload);
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(json).not.toHaveBeenCalled();
  });

  it('requires a session', async () => {
    const response = await post('lookup', { term: 'table' }, false);
    expect(response.statusCode).toBe(401);
  });

  it('returns AssistFailed after the gateway retries invalid output once', async () => {
    await app.close();
    const generate = vi.fn<GenerateFn>(async () => ({ text: '{}' }));
    app = await buildTestApp({
      assist: { gateway: createAiGateway({ googleApiKey: 'test', generate }) },
    });

    const response = await post('lookup', { term: 'table' });
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('ASSIST_FAILED');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  describe('daily quota (AC8)', () => {
    const limited = async () => {
      await app.close();
      app = await buildTestApp({
        planLimits: resolvePlanLimits({ free: { assist_daily: 2 } }),
        assist: { gateway: { json: json as unknown as AiGateway['json'] } },
      });
    };

    it('shares one daily allowance across lookup, recap and compose, then answers 429 without calling AI', async () => {
      await limited();
      expect((await post('lookup', { term: 'table' })).statusCode).toBe(200);
      expect((await post('compose', { intentVi: 'Xin chào' })).statusCode).toBe(200);
      expect(json).toHaveBeenCalledTimes(2);

      const refused = await post('recap', { sentences: [{ speaker: 'Mia', text: 'Hi.' }] });
      expect(refused.statusCode).toBe(429);
      expect(refused.json().error.code).toBe('QUOTA_EXCEEDED');
      expect(refused.json().error.details).toMatchObject({
        metric: 'assist_daily',
        plan: 'free',
        used: 2,
        limit: 2,
      });
      expect(json).toHaveBeenCalledTimes(2);
    });

    it('does not spend the allowance on an invalid body', async () => {
      await limited();
      await post('lookup', { term: '' });
      await post('lookup', { term: '' });
      expect((await post('lookup', { term: 'table' })).statusCode).toBe(200);
    });

    it('counts per user: another person still has their own allowance', async () => {
      await limited();
      await post('lookup', { term: 'a' });
      await post('lookup', { term: 'b' });
      const other = await app.inject({
        method: 'POST',
        url: '/v1/assist/lookup',
        headers: { [TEST_USER_HEADER]: 'bob' },
        payload: { term: 'c' },
      });
      expect(other.statusCode).toBe(200);
    });

    it('leaves the assistant tool path uncounted', async () => {
      await limited();
      const assist = createAssistModule(
        { gateway: { json: json as unknown as AiGateway['json'] } },
        { reserve: vi.fn() },
      );
      await assist.service.lookup(USER, { term: 'table' });
      await assist.service.lookup(USER, { term: 'table' });
      await assist.service.lookup(USER, { term: 'table' });
      expect((await post('lookup', { term: 'table' })).statusCode).toBe(200);
    });
  });
});
