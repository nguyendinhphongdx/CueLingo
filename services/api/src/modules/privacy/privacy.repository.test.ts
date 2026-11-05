import { describe, expect, it } from 'vitest';
import type { Sql } from '../../lib/db';
import { createPostgresPrivacyRepository } from './privacy.repository';

/** A `sql` double that records the text of each statement and whether it ran inside `begin`. */
function recordingSql() {
  const log: Array<{ text: string; inTransaction: boolean }> = [];
  const make = (inTransaction: boolean) => {
    const tag = async (strings: TemplateStringsArray) => {
      log.push({ text: strings.join('?').replace(/\s+/g, ' ').trim(), inTransaction });
      return [];
    };
    return tag;
  };
  const sql = Object.assign(make(false), {
    begin: async (work: (tx: unknown) => Promise<unknown>) => work(make(true)),
  });
  return { sql: sql as unknown as Sql, log };
}

describe('privacy repository deleteMyData', () => {
  it('removes assistant messages and conversations, soft-deleted ones included, in the same transaction', async () => {
    const { sql, log } = recordingSql();
    await createPostgresPrivacyRepository(sql).deleteMyData('user-1');

    const deletes = log.filter((entry) => entry.text.startsWith('DELETE FROM'));
    const tables = deletes.map((entry) => /DELETE FROM (\w+)/.exec(entry.text)![1]);
    expect(tables).toContain('agent_messages');
    expect(tables).toContain('agent_conversations');
    expect(deletes.every((entry) => entry.inTransaction)).toBe(true);
    // Messages first, then their conversations; both scoped by user and neither filters on deleted_at.
    expect(tables.indexOf('agent_messages')).toBeLessThan(tables.indexOf('agent_conversations'));
    for (const entry of deletes.filter((e) => e.text.includes('agent_'))) {
      expect(entry.text).toContain('WHERE user_id = ?');
      expect(entry.text).not.toContain('deleted_at');
    }
  });
});
