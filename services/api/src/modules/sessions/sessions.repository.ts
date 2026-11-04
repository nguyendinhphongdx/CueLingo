import {
  DEFAULT_LANGUAGE,
  type CreateSessionRequest,
  type LanguageCode,
  type Session,
  type SessionDetail,
  type Speaker,
  type SpeakerLabel,
  type StoredSegment,
} from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

export interface SaveSegmentInput {
  sessionId: string;
  userId: string;
  segmentId: string;
  source: StoredSegment['source'];
  startMs: number;
  endMs: number;
  textEn: string;
  /** Language of this segment; stored only when it differs from the meeting's. */
  language?: LanguageCode;
  /** Already validated label of who spoke; null/absent leaves the segment unlabelled. */
  speaker?: SpeakerLabel | null;
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
  /** Status and stored segment count, for deciding whether a debrief can be queued. */
  findDebriefState(
    userId: string,
    id: string,
  ): Promise<{ status: Session['status']; segmentCount: number } | null>;
  create(userId: string, input: CreateSessionRequest): Promise<Session>;
  end(userId: string, id: string): Promise<EndSessionResult | null>;
  softDelete(userId: string, id: string): Promise<boolean>;
  setLanguage(userId: string, id: string, language: LanguageCode): Promise<Session | null>;
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
  language: Session['language'];
}

interface SegmentRow {
  id: string;
  source: StoredSegment['source'];
  start_ms: number;
  end_ms: number;
  text_en: string;
  text_vi: string | null;
  speaker_id: string | null;
}

interface SpeakerRow {
  id: string;
  label: SpeakerLabel;
  display_name: string | null;
}

const toSpeaker = (row: SpeakerRow): Speaker => ({
  id: row.id,
  label: row.label,
  displayName: row.display_name,
});

const toSession = (row: SessionRow): Session => ({
  id: row.id,
  title: row.title,
  startedAt: row.started_at.toISOString(),
  endedAt: row.ended_at?.toISOString() ?? null,
  status: row.status,
  assistLevel: row.assist_level,
  language: row.language,
});

const toSegment = (row: SegmentRow): StoredSegment => ({
  id: row.id,
  source: row.source,
  startMs: row.start_ms,
  endMs: row.end_ms,
  textEn: row.text_en,
  textVi: row.text_vi,
  speakerId: row.speaker_id,
});

export function createPostgresSessionsRepository(sql: Sql): SessionsRepository {
  return {
    async list(userId) {
      const rows = await sql<SessionRow[]>`
        SELECT id, title, started_at, ended_at, status, assist_level, language FROM sessions
        WHERE user_id = ${userId} AND status <> 'deleted' ORDER BY started_at DESC`;
      return rows.map(toSession);
    },
    async findById(userId, id) {
      const [row] = await sql<SessionRow[]>`
        SELECT id, title, started_at, ended_at, status, assist_level, language FROM sessions
        WHERE user_id = ${userId} AND id = ${id} AND status <> 'deleted'`;
      return row ? toSession(row) : null;
    },
    async findDetail(userId, id) {
      const [row] = await sql<SessionRow[]>`
        SELECT id, title, started_at, ended_at, status, assist_level, language FROM sessions
        WHERE user_id = ${userId} AND id = ${id} AND status <> 'deleted'`;
      if (!row) return null;
      const segments = await sql<SegmentRow[]>`
        SELECT segments.id, source, start_ms, end_ms, text_en, text_vi, speaker_id
        FROM segments JOIN sessions ON sessions.id = segments.session_id
        WHERE sessions.user_id = ${userId} AND sessions.id = ${id}
        ORDER BY start_ms`;
      const speakers = await sql<SpeakerRow[]>`
        SELECT speakers.id, speakers.label, speakers.display_name
        FROM speakers JOIN sessions ON sessions.id = speakers.session_id
        WHERE sessions.user_id = ${userId} AND sessions.id = ${id}
        ORDER BY (speakers.label = 'me') DESC, speakers.label`;
      return {
        ...toSession(row),
        segments: segments.map(toSegment),
        speakers: speakers.map(toSpeaker),
      };
    },
    async findDebriefState(userId, id) {
      const [row] = await sql<{ status: Session['status']; segmentCount: number }[]>`
        SELECT s.status, (SELECT count(*) FROM segments g WHERE g.session_id = s.id)::int AS "segmentCount"
        FROM sessions s
        WHERE s.user_id = ${userId} AND s.id = ${id} AND s.status <> 'deleted'`;
      return row ?? null;
    },
    async create(userId, input) {
      const [row] = await sql<SessionRow[]>`
        INSERT INTO sessions (user_id, title, assist_level, language)
        VALUES (${userId}, ${input.title ?? null}, ${input.assistLevel}, ${input.language ?? DEFAULT_LANGUAGE})
        RETURNING id, title, started_at, ended_at, status, assist_level, language`;
      return toSession(row!);
    },
    async end(userId, id) {
      const [ended] = await sql<SessionRow[]>`
        UPDATE sessions SET ended_at = now(), status = 'ended'
        WHERE user_id = ${userId} AND id = ${id} AND status = 'live'
        RETURNING id, title, started_at, ended_at, status, assist_level, language`;
      if (ended) return { session: toSession(ended), endedNow: true };
      const [existing] = await sql<SessionRow[]>`
        SELECT id, title, started_at, ended_at, status, assist_level, language FROM sessions
        WHERE user_id = ${userId} AND id = ${id} AND status <> 'deleted'`;
      return existing ? { session: toSession(existing), endedNow: false } : null;
    },
    async softDelete(userId, id) {
      const result = await sql`
        UPDATE sessions SET status = 'deleted', ended_at = now()
        WHERE user_id = ${userId} AND id = ${id} AND status <> 'deleted'`;
      return result.count > 0;
    },
    async setLanguage(userId, id, language) {
      const [row] = await sql<SessionRow[]>`
        UPDATE sessions SET language = ${language}
        WHERE user_id = ${userId} AND id = ${id} AND status <> 'deleted'
        RETURNING id, title, started_at, ended_at, status, assist_level, language`;
      return row ? toSession(row) : null;
    },
    async saveSegment(input) {
      const label = input.speaker ?? null;
      // One statement: the speaker row is only created for a session the user owns, then the segment points at it.
      const inserted = await sql<{ id: string }[]>`
        WITH owned AS (
          SELECT sessions.id, sessions.language FROM sessions
          WHERE sessions.id = ${input.sessionId} AND sessions.user_id = ${input.userId}
            AND sessions.status <> 'deleted'
        ), speaker AS (
          INSERT INTO speakers (session_id, label)
          SELECT owned.id, ${label}::text FROM owned WHERE ${label}::text IS NOT NULL
          ON CONFLICT (session_id, label) DO UPDATE SET label = EXCLUDED.label
          RETURNING id
        )
        INSERT INTO segments (id, session_id, source, start_ms, end_ms, text_en, language, speaker_id)
        SELECT ${input.segmentId}, owned.id, ${input.source}, ${input.startMs},
          ${input.endMs}, ${input.textEn},
          CASE WHEN ${input.language ?? null}::text IS NULL OR owned.language = ${input.language ?? null}
               THEN NULL ELSE ${input.language ?? null} END,
          (SELECT id FROM speaker)
        FROM owned
        ON CONFLICT (id) DO NOTHING
        RETURNING id`;
      if (inserted.length > 0) return true;
      const existing = await sql<{ id: string }[]>`
        SELECT segments.id FROM segments
        JOIN sessions ON sessions.id = segments.session_id
        WHERE segments.id = ${input.segmentId}
          AND sessions.id = ${input.sessionId}
          AND sessions.user_id = ${input.userId}
          AND sessions.status <> 'deleted'`;
      return existing.length > 0;
    },
    async saveTranslation(segmentId, textVi) {
      await sql`UPDATE segments SET text_vi = ${textVi} WHERE id = ${segmentId}`;
    },
  };
}
