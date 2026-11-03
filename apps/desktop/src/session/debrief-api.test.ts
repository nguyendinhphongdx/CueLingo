import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDebriefApi,
  DebriefError,
  describeFollowupError,
  FOLLOWUP_TIMEOUT_MS,
} from './debrief-api';

vi.mock('../lib/native', () => ({ native: {} }));

const id = '6df65d24-949f-4456-b5d2-4394c9d7ae16';
const input = { channel: 'email', tone: 'polite' } as const;
const draft = { subject: 'Tóm tắt', body: 'Chào cả nhóm', language: 'vi' };

afterEach(() => vi.useRealTimers());

describe('debrief api followup', () => {
  it('posts the request with the bearer token and parses the draft', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(draft));
    const api = createDebriefApi({ apiUrl: 'ws://api.test/', token: 'secret', fetch: request });

    await expect(api.followup(id, input)).resolves.toEqual(draft);

    expect(request.mock.calls[0]?.[0]).toBe(`http://api.test/v1/sessions/${id}/followup`);
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
      body: JSON.stringify(input),
    });
  });

  it('throws an error with the status and without any draft text', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ body: 'secret draft' }), { status: 404 }));
    const api = createDebriefApi({ apiUrl: 'http://api.test', token: 't', fetch: request });
    const error = await api.followup(id, input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DebriefError);
    expect((error as DebriefError).status).toBe(404);
    expect((error as DebriefError).message).not.toContain('secret draft');
  });

  it('rejects a malformed body without echoing it', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ body: 'private text', extra: 1 }));
    const api = createDebriefApi({ apiUrl: 'http://api.test', token: 't', fetch: request });
    const error = await api.followup(id, input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DebriefError);
    expect((error as DebriefError).message).not.toContain('private text');
  });

  it('aborts after 20 seconds', async () => {
    vi.useFakeTimers();
    const request = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const api = createDebriefApi({ apiUrl: 'http://api.test', token: 't', fetch: request });
    const result = api.followup(id, input).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(FOLLOWUP_TIMEOUT_MS);
    const error = await result;
    expect(error).toBeInstanceOf(DebriefError);
    expect((error as DebriefError).message).toContain('timed out');
  });
});

describe('describeFollowupError', () => {
  it.each([
    [401, 'Hãy đăng nhập lại để soạn follow-up.'],
    [403, 'Hãy đăng nhập lại để soạn follow-up.'],
    [429, 'Bạn soạn hơi nhanh, đợi một lát rồi thử lại.'],
    [404, 'Debrief chưa sẵn sàng.'],
    [500, 'Không soạn được bản nháp. Hãy thử lại.'],
  ])('maps status %i', (status, text) => {
    expect(describeFollowupError(new DebriefError('x', status))).toBe(text);
  });

  it('uses the generic message without a status', () => {
    expect(describeFollowupError(new DebriefError('timed out'))).toBe(
      'Không soạn được bản nháp. Hãy thử lại.',
    );
    expect(describeFollowupError(new Error('x'))).toBe('Không soạn được bản nháp. Hãy thử lại.');
  });
});
