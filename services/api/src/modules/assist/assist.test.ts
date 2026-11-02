import { createAiGateway, type AiGateway, type GenerateFn } from '@cuelingo/ai-gateway';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';

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
});
