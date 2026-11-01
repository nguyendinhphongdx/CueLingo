import type { Export } from '@cuelingo/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import type { PrivacyRepository } from './privacy.repository';

const ALICE = 'alice';
const BOB = 'bob';
const as = (user: string) => ({ [TEST_USER_HEADER]: user });

describe('privacy module', () => {
  let app: FastifyInstance;
  let repo: PrivacyRepository;
  const exported: Export = {
    exportedAt: '2026-11-06T09:00:00.000Z',
    sessions: [],
    phrases: [],
    glossaryTerms: [],
  };

  beforeEach(async () => {
    repo = {
      deleteMyData: vi.fn(async () => undefined),
      exportMyData: vi.fn(async () => exported),
    };
    app = await buildTestApp({ repos: { privacy: repo } });
  });
  afterEach(() => app.close());

  it('requires the exact confirmation and does not delete on invalid input', async () => {
    for (const payload of [
      {},
      { confirm: 'xoa du lieu' },
      { confirm: 'XOA DU LIEU', extra: true },
    ]) {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/me/data',
        headers: as(ALICE),
        payload,
      });
      expect(response.statusCode).toBe(400);
    }
    expect(repo.deleteMyData).not.toHaveBeenCalled();
  });

  it('deletes only for the authenticated user after confirmation', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/me/data',
      headers: as(ALICE),
      payload: { confirm: 'XOA DU LIEU' },
    });
    expect(response.statusCode).toBe(204);
    expect(repo.deleteMyData).toHaveBeenCalledWith(ALICE);
    expect(repo.deleteMyData).not.toHaveBeenCalledWith(BOB);
  });

  it('exports only through the authenticated user scope', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/me/export',
      headers: as(BOB),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(exported);
    expect(repo.exportMyData).toHaveBeenCalledWith(BOB, expect.any(Date));
  });
});
