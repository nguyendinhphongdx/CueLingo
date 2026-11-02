import type { Me } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

/** The signed-in person's own profile. Everything is scoped by the authenticated user id. */
export interface AccountRepository {
  get(userId: string): Promise<Me | null>;
  updateName(userId: string, name: string): Promise<Me | null>;
  /** Removes the person; their meetings, phrases, devices and the rest go with them (ON DELETE CASCADE). */
  delete(userId: string): Promise<boolean>;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

const toMe = (row: UserRow): Me => ({
  id: row.id,
  email: row.email,
  name: row.name,
  createdAt: row.createdAt.toISOString(),
});

export function createPostgresAccountRepository(sql: Sql): AccountRepository {
  return {
    async get(userId) {
      const [row] = await sql<UserRow[]>`
        SELECT id, email, name, "createdAt" FROM auth_user WHERE id = ${userId}`;
      return row ? toMe(row) : null;
    },

    async updateName(userId, name) {
      const [row] = await sql<UserRow[]>`
        UPDATE auth_user SET name = ${name}, "updatedAt" = now() WHERE id = ${userId}
        RETURNING id, email, name, "createdAt"`;
      return row ? toMe(row) : null;
    },

    async delete(userId) {
      const result = await sql`DELETE FROM auth_user WHERE id = ${userId}`;
      return result.count > 0;
    },
  };
}

/** In-memory implementation for tests and local demos; `seed` adds a person. */
export function createInMemoryAccountRepository(): AccountRepository & {
  seed(me: Me): void;
} {
  const people = new Map<string, Me>();
  return {
    seed(me) {
      people.set(me.id, me);
    },
    async get(userId) {
      return people.get(userId) ?? null;
    },
    async updateName(userId, name) {
      const me = people.get(userId);
      if (!me) return null;
      const updated = { ...me, name };
      people.set(userId, updated);
      return updated;
    },
    async delete(userId) {
      return people.delete(userId);
    },
  };
}
