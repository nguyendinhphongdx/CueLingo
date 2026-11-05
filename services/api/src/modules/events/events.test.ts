import type { LearningEvent } from '@cuelingo/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import type { EventsRepository } from './events.repository';

const ALICE = 'alice';
const AT = '2026-11-02T09:00:00.000Z';

describe('events module', () => {
  let app: FastifyInstance;
  let append: ReturnType<typeof vi.fn<EventsRepository['append']>>;

  beforeEach(async () => {
    append = vi.fn<EventsRepository['append']>().mockResolvedValue(undefined);
    app = await buildTestApp({ repos: { events: { append } } });
  });
  afterEach(() => app.close());

  const post = (payload: unknown, authenticated = true) =>
    app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: authenticated ? { [TEST_USER_HEADER]: ALICE } : {},
      payload: payload as object,
    });

  it('appends one valid event with the user id from the session', async () => {
    const event: LearningEvent = { type: 'lookup', term: 'roadmap', at: AT };
    const response = await post({ events: [event] });

    expect(response.statusCode).toBe(204);
    expect(append).toHaveBeenCalledWith(ALICE, [event]);
  });

  it('accepts a batch of 100 valid events', async () => {
    const events: LearningEvent[] = Array.from({ length: 100 }, () => ({
      type: 'recap_used',
      at: AT,
    }));
    const response = await post({ events });

    expect(response.statusCode).toBe(204);
    expect(append).toHaveBeenCalledWith(ALICE, events);
  });

  it('rejects the whole batch when one event is invalid', async () => {
    const response = await post({
      events: [
        { type: 'recap_used', at: AT },
        { type: 'compose_used', chosenIndex: 3, at: AT },
      ],
    });

    expect(response.statusCode).toBe(400);
    expect(append).not.toHaveBeenCalled();
  });

  it('has no routes that update or delete events', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: '/v1/events/019a3db4-54c0-7000-8000-000000000001',
      headers: { [TEST_USER_HEADER]: ALICE },
      payload: {},
    });
    const remove = await app.inject({
      method: 'DELETE',
      url: '/v1/events/019a3db4-54c0-7000-8000-000000000001',
      headers: { [TEST_USER_HEADER]: ALICE },
    });

    expect(patch.statusCode).toBe(404);
    expect(remove.statusCode).toBe(404);
  });

  it('requires authentication', async () => {
    const response = await post({ events: [{ type: 'recap_used', at: AT }] }, false);

    expect(response.statusCode).toBe(401);
    expect(append).not.toHaveBeenCalled();
  });
});

describe('activation events (AC7)', () => {
  it('accepts app_installed_first_run and first_caption_shown, and no text rides along', async () => {
    const append = vi.fn().mockResolvedValue(undefined);
    const app = await buildTestApp({ repos: { events: { append } } });
    const post = (events: unknown[]) =>
      app.inject({
        method: 'POST',
        url: '/v1/events',
        headers: { [TEST_USER_HEADER]: ALICE },
        payload: { events },
      });

    const ok = await post([
      { type: 'app_installed_first_run', at: AT },
      { type: 'first_caption_shown', at: AT },
    ]);
    expect(ok.statusCode).toBe(204);

    const withText = await post([{ type: 'first_caption_shown', at: AT, text: 'hello' }]);
    expect(withText.statusCode).toBe(400);
    await app.close();
  });

  it('does not let a client write session_started: the server does', async () => {
    const append = vi.fn().mockResolvedValue(undefined);
    const app = await buildTestApp({ repos: { events: { append } } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { [TEST_USER_HEADER]: ALICE },
      payload: { events: [{ type: 'session_started', at: AT }] },
    });
    expect(res.statusCode).toBe(400);
    expect(append).not.toHaveBeenCalled();
    await app.close();
  });

  it('refuses an assist suggestion for Vietnamese, which is not a learnable language (AC15)', async () => {
    const append = vi.fn().mockResolvedValue(undefined);
    const app = await buildTestApp({ repos: { events: { append } } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { [TEST_USER_HEADER]: ALICE },
      payload: {
        events: [
          { type: 'assist_suggestion', action: 'applied', level: 1, language: 'vi', at: AT },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
