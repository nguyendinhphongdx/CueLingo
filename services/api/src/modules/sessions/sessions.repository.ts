import type { CreateSessionRequest, Session, SessionDetail, StoredSegment } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

export interface SaveSegmentInput {
  sessionId: string;
  userId: string;
  segmentId: string;
  source: StoredSegment['source'];
  startMs: number;
  endMs: number;
  textEn: string;
}

export interface EndSessionResult {
  session: Session;
  endedNow: boolean;
}

/** Session data access. Every read and mutation is scoped by the authenticated user. */
export interface SessionsRepository {
  list(userId: string): Promise<Session[]>;
  findById(userId: string, id: string): Promise<Session | null>;
  findDetail(userId: string, id: string): Promise<SessionDetail | null>;
  create(userId: string, input: CreateSessionRequest): Promise<Session>;
  end(userId: string, id: string): Promise<EndSessionResult | null>;
  saveSegment(input: SaveSegmentInput): Promise<boolean>;
  saveTranslation(segmentId: string, textVi: string): Promise<void>;
}

interface SessionRow {
  id: string;
  title: string | null;
  started_at: Date;
  ended_at: Date | null;
  status: Session['status'];
  assist_level: number;
}

interface SegmentRow {
  id: string;
  source: StoredSegment['source'];
  start_ms: number;
  end_ms: number;
  text_en: string;
  text_vi: string | null;
}

const toSession = (row: SessionRow): Session => ({
  id: row.id,
  title: row.title,
  startedAt: row.started_at.toISOString(),
  endedAt: row.ended_at?.toISOString() ?? null,
  status: row.status,
  assistLevel: row.assist_level,
});

const toSegment = (row: SegmentRow): StoredSegment => ({
  id: row.id,
  source: row.source,
  startMs: row.start_ms,
  endMs: row.end_ms,
  textEn: row.text_en,
  textVi: row.text_vi,
});

export function createPostgresSessionsRepository(sql: Sql): SessionsRepository {
  return {
    async list(userId) {
      const rows = await sql<SessionRow[]>`
        SELECT id, title, started_at, ended_at, status, assist_level FROM sessions
        WHERE user_id = ${userId} ORDER BY started_at DESC`;
      return rows.map(toSession);
    },
    async findById(userId, id) {
      const [row] = await sql<SessionRow[]>`
        SELECT id, title, started_at, ended_at, status, assist_level FROM sessions
        WHERE user_id = ${userId} AND id = ${id}`;
      return row ? toSession(row) : null;
    },
    async findDetail(userId, id) {
      const [row] = await sql<SessionRow[]>`
        SELECT id, title, started_at, ended_at, status, assist_level FROM sessions
        WHERE user_id = ${userId} AND id = ${id}`;
      if (!row) return null;
      const segments = await sql<SegmentRow[]>`
        SELECT segments.id, source, start_ms, end_ms, text_en, text_vi
        FROM segments JOIN sessions ON sessions.id = segments.session_id
        WHERE sessions.user_id = ${userId} AND sessions.id = ${id}
        ORDER BY start_ms`;
      return { ...toSession(row), segments: segments.map(toSegment) };
    },
    async create(userId, input) {
      const [row] = await sql<SessionRow[]>`
        INSERT INTO sessions (user_id, title, assist_level)
        VALUES (${userId}, ${input.title ?? null}, ${input.assistLevel})
        RETURNING id, title, started_at, ended_at, status, assist_level`;
      return toSession(row!);
    },
    async end(userId, id) {
      const [ended] = await sql<SessionRow[]>`
        UPDATE sessions SET ended_at = now(), status = 'ended'
        WHERE user_id = ${userId} AND id = ${id} AND status = 'live'
        RETURNING id, title, started_at, ended_at, status, assist_level`;
      if (ended) return { session: toSession(ended), endedNow: true };
      const [existing] = await sql<SessionRow[]>`
        SELECT id, title, started_at, ended_at, status, assist_level FROM sessions
        WHERE user_id = ${userId} AND id = ${id}`;
      return existing ? { session: toSession(existing), endedNow: false } : null;
    },
    async saveSegment(input) {
      const inserted = await sql<{ id: string }[]>`
        INSERT INTO segments (id, session_id, source, start_ms, end_ms, text_en)
        SELECT ${input.segmentId}, sessions.id, ${input.source}, ${input.startMs},
          ${input.endMs}, ${input.textEn}
        FROM sessions
        WHERE sessions.id = ${input.sessionId} AND sessions.user_id = ${input.userId}
        ON CONFLICT (id) DO NOTHING
        RETURNING id`;
      if (inserted.length > 0) return true;
      const existing = await sql<{ id: string }[]>`
        SELECT segments.id FROM segments
        JOIN sessions ON sessions.id = segments.session_id
        WHERE segments.id = ${input.segmentId}
          AND sessions.id = ${input.sessionId}
          AND sessions.user_id = ${input.userId}`;
      return existing.length > 0;
    },
    async saveTranslation(segmentId, textVi) {
      await sql`UPDATE segments SET text_vi = ${textVi} WHERE id = ${segmentId}`;
    },
  };
}
