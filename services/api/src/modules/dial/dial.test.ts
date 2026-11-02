import { describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemoryDialRepository } from './dial.repository';

const as = (user: string) => ({ [TEST_USER_HEADER]: user });
const meeting = (daysAgo: number, pct: number, lookups = 2) => ({
  comprehensionPct: pct,
  lookups,
  startedAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
});

describe('GET /v1/me/assist-suggestion', () => {
  it('suggests lowering the help after three strong meetings', async () => {
    const dial = createInMemoryDialRepository();
    dial.set('alice', {
      currentLevel: 4,
      meetings: [meeting(1, 92), meeting(3, 90), meeting(5, 88)],
      lastDecisionAt: null,
    });
    const app = await buildTestApp({ repos: { dial } });
    const response = await app.inject({
      method: 'GET',
      url: '/v1/me/assist-suggestion',
      headers: as('alice'),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ kind: 'lower', currentLevel: 4, suggestedLevel: 3 });
    await app.close();
  });

  it('says keep when there is not enough to go on, and never leaks another person', async () => {
    const dial = createInMemoryDialRepository();
    dial.set('alice', {
      currentLevel: 4,
      meetings: [meeting(1, 92), meeting(3, 90), meeting(5, 88)],
      lastDecisionAt: null,
    });
    const app = await buildTestApp({ repos: { dial } });
    const bob = await app.inject({
      method: 'GET',
      url: '/v1/me/assist-suggestion',
      headers: as('bob'),
    });
    expect(bob.json()).toEqual({ kind: 'keep', currentLevel: 4 });
    await app.close();
  });

  it('stays quiet for a week after the person answered', async () => {
    const dial = createInMemoryDialRepository();
    dial.set('alice', {
      currentLevel: 4,
      meetings: [meeting(1, 95), meeting(2, 95), meeting(3, 95)],
      lastDecisionAt: new Date(Date.now() - 86_400_000).toISOString(),
    });
    const app = await buildTestApp({ repos: { dial } });
    const response = await app.inject({
      method: 'GET',
      url: '/v1/me/assist-suggestion',
      headers: as('alice'),
    });
    expect(response.json().kind).toBe('keep');
    await app.close();
  });

  it('needs a session', async () => {
    const app = await buildTestApp();
    expect((await app.inject({ method: 'GET', url: '/v1/me/assist-suggestion' })).statusCode).toBe(
      401,
    );
    await app.close();
  });
});
