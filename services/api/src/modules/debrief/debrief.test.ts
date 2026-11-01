import type { Debrief } from '@cuelingo/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryDebriefRepository } from './debrief.repository.memory';

const ALICE = 'alice';
const BOB = 'bob';
const SESSION_ID = '9ee72a14-8cd4-4f2e-8131-4ed638e2d875';
const FIRST_ID = 'c67ef96d-7890-49a7-9a55-66c49272e38f';
const LATEST_ID = '34ac6374-b84a-4491-8873-2906a1b60186';

const debrief = (id: string, version: number): Debrief => ({
  id,
  sessionId: SESSION_ID,
  version,
  createdAt: `2026-11-0${version}T09:00:00.000Z`,
  summary: { headlineVi: `Bản ${version}`, bulletsVi: [] },
  actionItems: [],
  hardSegmentIds: [],
  phraseSuggestions: [],
  rephrase: [],
  comprehensionPct: 80,
});

describe('debrief module', () => {
  let app: FastifyInstance;
  const repo = createInMemoryDebriefRepository();

  beforeEach(async () => {
    repo.seed(ALICE, debrief(FIRST_ID, 1));
    repo.seed(ALICE, debrief(LATEST_ID, 2));
    app = await buildTestApp({ repos: { debrief: repo } });
  });
  afterEach(() => app.close());

  const as = (user: string) => ({ [TEST_USER_HEADER]: user });

  it('returns the highest debrief version', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${SESSION_ID}/debrief`,
      headers: as(ALICE),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: LATEST_ID, version: 2 });
  });

  it("returns 404 for a missing or another user's debrief", async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${SESSION_ID}/debrief`,
      headers: as(BOB),
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('records feedback and rejects an invalid body', async () => {
    const valid = await app.inject({
      method: 'POST',
      url: `/v1/debriefs/${LATEST_ID}/feedback`,
      headers: as(ALICE),
      payload: { block: 'summary', useful: true },
    });
    const invalid = await app.inject({
      method: 'POST',
      url: `/v1/debriefs/${LATEST_ID}/feedback`,
      headers: as(ALICE),
      payload: { block: 'unknown', useful: true },
    });
    expect(valid.statusCode).toBe(204);
    expect(repo.feedback.at(-1)).toEqual({
      userId: ALICE,
      debriefId: LATEST_ID,
      input: { block: 'summary', useful: true },
    });
    expect(invalid.statusCode).toBe(400);
  });

  it("does not accept feedback for another user's debrief", async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/debriefs/${LATEST_ID}/feedback`,
      headers: as(BOB),
      payload: { block: 'summary', useful: false },
    });
    expect(response.statusCode).toBe(404);
  });
});
