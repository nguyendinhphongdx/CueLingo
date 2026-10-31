import type { CreateGlossaryTerm, GlossaryTerm, UpdateGlossaryTerm } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

/** Data access for glossary terms. Every method is scoped by the authenticated user's id. */
export interface GlossaryRepository {
  list(userId: string): Promise<GlossaryTerm[]>;
  findById(userId: string, id: string): Promise<GlossaryTerm | null>;
  findByTerm(userId: string, term: string): Promise<GlossaryTerm | null>;
  create(userId: string, input: CreateGlossaryTerm): Promise<GlossaryTerm>;
  update(userId: string, id: string, patch: UpdateGlossaryTerm): Promise<GlossaryTerm | null>;
  delete(userId: string, id: string): Promise<boolean>;
}

interface GlossaryRow {
  id: string;
  term: string;
  translation: string | null;
  note: string | null;
  created_at: Date;
}

const toTerm = (row: GlossaryRow): GlossaryTerm => ({
  id: row.id,
  term: row.term,
  translation: row.translation,
  note: row.note,
  createdAt: row.created_at.toISOString(),
});

export function createPostgresGlossaryRepository(sql: Sql): GlossaryRepository {
  return {
    async list(userId) {
      const rows = await sql<GlossaryRow[]>`
        SELECT id, term, translation, note, created_at FROM glossary_terms
        WHERE user_id = ${userId} ORDER BY lower(term)`;
      return rows.map(toTerm);
    },
    async findById(userId, id) {
      const [row] = await sql<GlossaryRow[]>`
        SELECT id, term, translation, note, created_at FROM glossary_terms
        WHERE user_id = ${userId} AND id = ${id}`;
      return row ? toTerm(row) : null;
    },
    async findByTerm(userId, term) {
      const [row] = await sql<GlossaryRow[]>`
        SELECT id, term, translation, note, created_at FROM glossary_terms
        WHERE user_id = ${userId} AND lower(term) = lower(${term})`;
      return row ? toTerm(row) : null;
    },
    async create(userId, input) {
      const [row] = await sql<GlossaryRow[]>`
        INSERT INTO glossary_terms (user_id, term, translation, note)
        VALUES (${userId}, ${input.term}, ${input.translation}, ${input.note})
        RETURNING id, term, translation, note, created_at`;
      return toTerm(row!);
    },
    async update(userId, id, patch) {
      const [row] = await sql<GlossaryRow[]>`
        UPDATE glossary_terms SET
          term = COALESCE(${patch.term ?? null}, term),
          translation = CASE WHEN ${patch.translation !== undefined} THEN ${patch.translation ?? null} ELSE translation END,
          note = CASE WHEN ${patch.note !== undefined} THEN ${patch.note ?? null} ELSE note END
        WHERE user_id = ${userId} AND id = ${id}
        RETURNING id, term, translation, note, created_at`;
      return row ? toTerm(row) : null;
    },
    async delete(userId, id) {
      const result = await sql`DELETE FROM glossary_terms WHERE user_id = ${userId} AND id = ${id}`;
      return result.count > 0;
    },
  };
}
