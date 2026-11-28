import type { MeetingAskStreamEvent } from '@cuelingo/shared';
import { describe, expect, it, vi } from 'vitest';
import { createClient } from './index';

const ID = '6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f';

const frames = (events: object[]) =>
  events
    .map(
      (event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`,
    )
    .join('');

const make = (fetch: ReturnType<typeof vi.fn>) =>
  createClient({
    baseUrl: 'http://api',
    getToken: () => 't0k',
    fetch: fetch as typeof globalThis.fetch,
  });

describe('meetingAssist client', () => {
  it('posts the question and delivers the events in order (AC2)', async () => {
    const sent: MeetingAskStreamEvent[] = [
      { type: 'status', status: 'searching' },
      { type: 'text_delta', text: 'Chào' },
      { type: 'sources', items: [{ kind: 'general' }] },
      { type: 'done', status: 'complete', questionId: ID },
    ];
    const fetch = vi.fn().mockResolvedValue(new Response(frames(sent)));
    const events: MeetingAskStreamEvent[] = [];
    await make(fetch).meetingAssist.ask(
      ID,
      { question: 'SSO?' },
      { onEvent: (event) => events.push(event) },
    );
    expect(events).toEqual(sent);
    expect(fetch.mock.calls[0]![0]).toBe(`http://api/v1/sessions/${ID}/questions`);
    expect(fetch.mock.calls[0]![1].headers.authorization).toBe('Bearer t0k');
  });

  it('throws the server refusal with its code and details (AC19)', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: { code: 'QUOTA_EXCEEDED', message: 'x', details: { limit: 10 } } },
          { status: 429 },
        ),
      );
    await expect(
      make(fetch).meetingAssist.ask(ID, { question: 'a' }, { onEvent: vi.fn() }),
    ).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED', details: { limit: 10 } });
  });

  it('resolves quietly when stopped and fails when the stream is cut (AC4, AC14)', async () => {
    const cut = vi
      .fn()
      .mockResolvedValue(new Response(frames([{ type: 'text_delta', text: 'nửa' }])));
    await expect(
      make(cut).meetingAssist.ask(ID, { question: 'a' }, { onEvent: vi.fn() }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });

    const controller = new AbortController();
    controller.abort();
    await expect(
      make(cut).meetingAssist.ask(
        ID,
        { question: 'a' },
        { signal: controller.signal, onEvent: vi.fn() },
      ),
    ).resolves.toBeUndefined();
  });

  it('reads and changes the consent', async () => {
    const fetch = vi.fn(async () => Response.json({ enabled: true, consent: true }));
    const client = make(fetch);
    await client.meetingAssist.status();
    await client.meetingAssist.setConsent(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
