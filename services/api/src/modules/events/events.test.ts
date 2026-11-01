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
