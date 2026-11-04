import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_USER_HEADER } from '../../testing';
import { createInMemorySessionsRepository } from '../sessions';

const ALICE = 'alice';
const BOB = 'bob';
const as = (user: string) => ({ [TEST_USER_HEADER]: user });

describe('speakers module', () => {
  let app: FastifyInstance;
  let sessions: ReturnType<typeof createInMemorySessionsRepository>;
  let sessionId: string;
  let otherId: string;
  let meId: string;

  const rename = (user: string, session: string, speaker: string, payload: unknown) =>
    app.inject({
      method: 'PATCH',
      url: `/v1/sessions/${session}/speakers/${speaker}`,
      headers: as(user),
      payload: payload as object,
    });

  beforeEach(async () => {
    sessions = createInMemorySessionsRepository();
    app = await buildTestApp({ repos: { sessions } });
    sessionId = (await sessions.create(ALICE, { assistLevel: 0 })).id;
    const save = (segmentId: string, source: 'mic' | 'system', speaker: 'me' | 'speaker_1') =>
      sessions.saveSegment({
        sessionId,
        userId: ALICE,
        segmentId,
        source,
        startMs: 0,
        endMs: 900,
        textEn: 'hello',
        speaker,
      });
    await save(randomUUID(), 'mic', 'me');
    await save(randomUUID(), 'system', 'speaker_1');
    await save(randomUUID(), 'system', 'speaker_1');
    const { speakers } = (await sessions.findDetail(ALICE, sessionId))!;
    meId = speakers.find((speaker) => speaker.label === 'me')!.id;
    otherId = speakers.find((speaker) => speaker.label === 'speaker_1')!.id;
  });
  afterEach(() => app.close());

  it('renames a speaker and every sentence of theirs reads the new name (AC4)', async () => {
    const response = await rename(ALICE, sessionId, otherId, { displayName: '  Lan  ' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      speaker: { id: otherId, label: 'speaker_1', displayName: 'Lan' },
    });

    const detail = (await sessions.findDetail(ALICE, sessionId))!;
    expect(detail.speakers.find((speaker) => speaker.id === otherId)?.displayName).toBe('Lan');
    expect(detail.segments.filter((segment) => segment.speakerId === otherId)).toHaveLength(2);

    const cleared = await rename(ALICE, sessionId, otherId, { displayName: null });
    expect(cleared.json().speaker.displayName).toBeNull();
  });

  it('answers 404 for another user, another session and a missing speaker, and changes nothing (AC5)', async () => {
    const foreign = await rename(BOB, sessionId, otherId, { displayName: 'Hacker' });
    expect(foreign.statusCode).toBe(404);
    expect(foreign.json().error.code).toBe('NOT_FOUND');
    expect((await rename(ALICE, randomUUID(), otherId, { displayName: 'X' })).statusCode).toBe(404);
    expect((await rename(ALICE, sessionId, randomUUID(), { displayName: 'X' })).statusCode).toBe(
      404,
    );

    const bobSession = (await sessions.create(BOB, { assistLevel: 0 })).id;
    expect((await rename(BOB, bobSession, otherId, { displayName: 'X' })).statusCode).toBe(404);

    const detail = (await sessions.findDetail(ALICE, sessionId))!;
    expect(detail.speakers.every((speaker) => speaker.displayName === null)).toBe(true);
  });

  it('refuses to rename "me" with 400', async () => {
    const response = await rename(ALICE, sessionId, meId, { displayName: 'Phong' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty or over-long name and extra fields', async () => {
    expect((await rename(ALICE, sessionId, otherId, { displayName: '   ' })).statusCode).toBe(400);
    expect(
      (await rename(ALICE, sessionId, otherId, { displayName: 'x'.repeat(41) })).statusCode,
    ).toBe(400);
    expect(
      (await rename(ALICE, sessionId, otherId, { displayName: 'A', userId: BOB })).statusCode,
    ).toBe(400);
  });

  it('requires a signed-in user', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/sessions/${sessionId}/speakers/${otherId}`,
      payload: { displayName: 'A' },
    });
    expect(response.statusCode).toBe(401);
  });
});
