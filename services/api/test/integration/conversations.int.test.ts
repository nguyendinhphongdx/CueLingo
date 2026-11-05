import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPostgresConversationsRepository } from '../../src/modules/conversations';
import { startMigratedPostgres, type TestDatabase } from './postgres';

/** Conversations on real Postgres: user boundary, soft delete, message order and the stale-streaming read. */
describe('conversations on real Postgres (AC13, AC14)', () => {
  let db: TestDatabase;
  let sql: postgres.Sql;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await startMigratedPostgres();
    sql = postgres(db.url);
    const users = await sql<{ id: string }[]>`
      INSERT INTO auth_user (name, email)
      VALUES ('Alice', 'conv-alice@example.com'), ('Bob', 'conv-bob@example.com') RETURNING id`;
    [alice, bob] = [users[0]!.id, users[1]!.id];
  });
  afterAll(async () => {
    await sql?.end();
    await db?.stop();
  });

  it('keeps conversations and messages inside the owner and numbers messages in order', async () => {
    const repo = createPostgresConversationsRepository(sql);
    const conversation = await repo.create(alice, 'en');
    const first = await repo.appendUserMessage(alice, conversation.id, 'Hello   there, coach');
    const second = await repo.beginAssistantMessage(alice, conversation.id);
    expect([first?.seq, second?.seq]).toEqual([0, 1]);
    expect(
      await repo.updateMessage(alice, second!.id, {
        parts: [{ type: 'text', text: 'Hi!' }],
        status: 'complete',
        inputTokens: 10,
        outputTokens: 2,
      }),
    ).toBe(true);

    const detail = await repo.get(alice, conversation.id);
    expect(detail?.conversation.title).toBe('Hello there, coach');
    expect(detail?.messages.map((m) => m.status)).toEqual(['complete', 'complete']);

    // Bob cannot read, rename, delete, append to or update anything of Alice.
    expect(await repo.get(bob, conversation.id)).toBeNull();
    expect(await repo.rename(bob, conversation.id, 'x')).toBeNull();
    expect(await repo.softDelete(bob, conversation.id)).toBe(false);
    expect(await repo.appendUserMessage(bob, conversation.id, 'x')).toBeNull();
    expect(await repo.updateMessage(bob, second!.id, { status: 'error' })).toBe(false);
    expect(await repo.list(bob)).toEqual([]);
    expect((await repo.get(alice, conversation.id))?.messages[1]?.status).toBe('complete');
  });

  it('hides a soft-deleted conversation from every read and write but keeps the rows', async () => {
    const repo = createPostgresConversationsRepository(sql);
    const conversation = await repo.create(alice, 'en');
    await repo.appendUserMessage(alice, conversation.id, 'to be deleted');
    expect(await repo.softDelete(alice, conversation.id)).toBe(true);

    expect(await repo.get(alice, conversation.id)).toBeNull();
    expect((await repo.list(alice)).some((c) => c.id === conversation.id)).toBe(false);
    expect(await repo.appendUserMessage(alice, conversation.id, 'late')).toBeNull();
    const [row] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM agent_messages WHERE conversation_id = ${conversation.id}`;
    expect(row?.count).toBe(1);
  });

  it('reads a message stuck in streaming for over 10 minutes as an error', async () => {
    const repo = createPostgresConversationsRepository(sql);
    const conversation = await repo.create(alice, 'en');
    const message = await repo.beginAssistantMessage(alice, conversation.id);
    expect((await repo.get(alice, conversation.id))?.messages[0]?.status).toBe('streaming');
    await sql`
      UPDATE agent_messages SET created_at = now() - interval '11 minutes' WHERE id = ${message!.id}`;
    expect((await repo.get(alice, conversation.id))?.messages[0]?.status).toBe('error');
  });

  it('counts a user message per turn for the daily quota', async () => {
    const repo = createPostgresConversationsRepository(sql);
    const before = await repo.countUserMessagesSince(bob, new Date(Date.now() - 86_400_000));
    const conversation = await repo.create(bob, 'en');
    await repo.appendUserMessage(bob, conversation.id, 'one');
    await repo.beginAssistantMessage(bob, conversation.id);
    expect(await repo.countUserMessagesSince(bob, new Date(Date.now() - 86_400_000))).toBe(
      before + 1,
    );
  });
});
