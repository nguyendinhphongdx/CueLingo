import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { placementItems } from './placement.content';
import { createInMemoryPlacementRepository } from './placement.repository';

const ALICE = 'alice';

describe('placement module', () => {
  let app: FastifyInstance;
  const repo = createInMemoryPlacementRepository();

  beforeEach(async () => {
    app = await buildTestApp({ repos: { placement: repo } });
  });
  afterEach(() => app.close());

  const as = { [TEST_USER_HEADER]: ALICE };
  const submit = (payload: unknown) =>
    app.inject({ method: 'POST', url: '/v1/placement', headers: as, payload: payload as object });
  const answersFor = (right: number) =>
    placementItems('en')!.map((item, index) => ({
      passageId: item.id,
      choice: index < right ? item.correctChoice : (item.correctChoice + 1) % 3,
    }));

  it('serves six passages in English without their answers', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/placement', headers: as });
    expect(response.statusCode).toBe(200);
    const test = response.json();
    expect(test.language).toBe('en');
    expect(test.passages).toHaveLength(6);
    expect(JSON.stringify(test)).not.toContain('correctChoice');
  });

  it('does not always put the right answer first', () => {
    const positions = new Set(placementItems('en')!.map((item) => item.correctChoice));
    expect(positions.size).toBeGreaterThan(1);
  });

  it('scores the answers and saves the level and starting assist level', async () => {
    const response = await submit({ answers: answersFor(4) });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      correct: 4,
      total: 6,
      listeningLevel: 'b2',
      assistDefault: 1,
    });
    expect(repo.saved(ALICE, 'en')).toEqual({ listeningLevel: 'b2', assistDefault: 1 });
  });

  it('counts a passage left out as wrong and lets the test be retaken', async () => {
    await submit({ answers: answersFor(6) });
    const retake = await submit({ answers: [] });
    expect(retake.json()).toMatchObject({ correct: 0, listeningLevel: 'a2', assistDefault: 4 });
    expect(repo.saved(ALICE, 'en')).toEqual({ listeningLevel: 'a2', assistDefault: 4 });
  });

  it('refuses a language that has no test or a malformed answer', async () => {
    const none = await app.inject({ method: 'GET', url: '/v1/placement?language=ja', headers: as });
    expect(none.statusCode).toBe(404);
    expect((await submit({ answers: [{ passageId: 'en-1', choice: 7 }] })).statusCode).toBe(400);
  });
});
