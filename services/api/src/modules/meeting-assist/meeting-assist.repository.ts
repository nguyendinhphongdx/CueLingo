import type { DebriefContent, MeetingAnswerSource, MeetingAnswerStatus } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

/** An earlier meeting that may hold something about the question. */
export interface PastSession {
  id: string;
  title: string | null;
  startedAt: string;
  headline: string | null;
  /** Summary and action items of the latest debrief, for matching. Empty without a debrief. */
  debriefText: string;
}

export interface PastHit {
  sessionId: string;
  segmentId: string;
  text: string;
  translation: string | null;
}

export interface PastSearch {
  sessions: PastSession[];
  hits: PastHit[];
  /** The search was given up for taking too long. */
  timedOut?: boolean;
}

export interface PastSearchInput {
  excludeSessionId: string;
  keywords: string[];
  since: Date;
}

export interface FinishQuestionInput {
  answer: string;
  sources: MeetingAnswerSource[];
  status: MeetingAnswerStatus;
}

/** Questions, consent and the search over earlier meetings. Every method is scoped by the signed-in user. */
export interface MeetingAssistRepository {
  /** The wording version the person agreed to, or null. */
  consentVersion(userId: string): Promise<string | null>;
  grantConsent(userId: string, version: string): Promise<void>;
  revokeConsent(userId: string): Promise<void>;
  /** Stores the question as `streaming`; null when the meeting is not this person's. */
  createQuestion(
    userId: string,
    sessionId: string,
    input: { question: string; promptVersion: string },
  ): Promise<string | null>;
  finishQuestion(userId: string, id: string, input: FinishQuestionInput): Promise<void>;
  /** The latest answered questions of this meeting, oldest first. */
  recentAnswers(
    userId: string,
    sessionId: string,
    limit: number,
  ): Promise<Array<{ question: string; answer: string }>>;
  /** Keyword search over this person's other meetings. An empty result when it takes too long. */
  searchPast(userId: string, input: PastSearchInput): Promise<PastSearch>;
  /** The given segments of one meeting with the sentence before and after each, in time order. */
  linesAround(
    userId: string,
    sessionId: string,
    segmentIds: string[],
  ): Promise<Array<{ speaker: string; text: string }>>;
}

/** How many of the newest meetings are searched, and how many matching sentences are read. */
export const PAST_SESSION_LIMIT = 100;
const PAST_HIT_LIMIT = 300;
const SEARCH_TIMEOUT_MS = 300;
/** Postgres `query_canceled`, raised when `statement_timeout` expires. */
const QUERY_CANCELED = '57014';

/** The words of a debrief that can match a question; never its field names. */
export const debriefText = ({
  summary,
  actionItems,
}: Pick<DebriefContent, 'summary' | 'actionItems'>): string =>
  [
    summary.headlineVi,
    ...summary.bulletsVi,
    ...actionItems.flatMap((item) => [item.textVi, item.owner ?? '']),
  ]
    .filter(Boolean)
    .join(' ');

export const speakerName = (row: {
  displayName: string | null;
  label: string | null;
  source: 'system' | 'mic';
}): string => {
  if (row.displayName) return row.displayName;
  if (row.label === 'me' || (!row.label && row.source === 'mic')) return 'Me';
  return row.label ? row.label.replace(/^speaker_/, 'Speaker ') : 'Others';
};

/** `%`, `_` and `\` are ordinary characters of a question, not wildcards. */
export const likePattern = (keyword: string): string =>
  `%${keyword.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

export function createPostgresMeetingAssistRepository(sql: Sql): MeetingAssistRepository {
  return {
    async consentVersion(userId) {
      const [row] = await sql<{ version: string }[]>`
        SELECT version FROM meeting_assist_consents WHERE user_id = ${userId}`;
      return row?.version ?? null;
    },
    async grantConsent(userId, version) {
      await sql`
        INSERT INTO meeting_assist_consents (user_id, version) VALUES (${userId}, ${version})
        ON CONFLICT (user_id) DO UPDATE SET version = EXCLUDED.version, granted_at = now()`;
    },
    async revokeConsent(userId) {
      await sql`DELETE FROM meeting_assist_consents WHERE user_id = ${userId}`;
    },
    async createQuestion(userId, sessionId, { question, promptVersion }) {
      const [row] = await sql<{ id: string }[]>`
        INSERT INTO meeting_questions (user_id, session_id, seq, question, prompt_version)
        SELECT ${userId}, sessions.id,
          COALESCE((SELECT max(seq) FROM meeting_questions WHERE session_id = sessions.id), 0) + 1,
          ${question}, ${promptVersion}
        FROM sessions
        WHERE sessions.id = ${sessionId} AND sessions.user_id = ${userId} AND sessions.status <> 'deleted'
        RETURNING id`;
      return row?.id ?? null;
    },
    async finishQuestion(userId, id, { answer, sources, status }) {
      await sql`
        UPDATE meeting_questions
        SET answer = ${answer}, sources = ${sql.json(sources)}, status = ${status}
        WHERE id = ${id} AND user_id = ${userId}`;
    },
    async recentAnswers(userId, sessionId, limit) {
      const rows = await sql<{ question: string; answer: string }[]>`
        SELECT question, answer FROM meeting_questions
        WHERE user_id = ${userId} AND session_id = ${sessionId}
          AND status IN ('complete', 'stopped') AND answer <> ''
        ORDER BY seq DESC LIMIT ${limit}`;
      return rows.map(({ question, answer }) => ({ question, answer })).reverse();
    },
    async searchPast(userId, { excludeSessionId, keywords, since }) {
      if (keywords.length === 0) return { sessions: [], hits: [] };
      const patterns = keywords.map(likePattern);
      try {
        return await sql.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL statement_timeout = '${SEARCH_TIMEOUT_MS}ms'`);
          const sessions = await tx<
            Array<{
              id: string;
              title: string | null;
              started_at: Date;
              headline: string | null;
              debrief_text: string | null;
            }>
          >`
            SELECT s.id, s.title, s.started_at, d.headline, d.debrief_text
            FROM (
              SELECT id, title, started_at FROM sessions
              WHERE user_id = ${userId} AND status <> 'deleted' AND id <> ${excludeSessionId}
                AND started_at >= ${since}
              ORDER BY started_at DESC LIMIT ${PAST_SESSION_LIMIT}
            ) s
            LEFT JOIN LATERAL (
              -- Values only: field names and kinds of the JSON must never count as a match.
              SELECT summary->>'headlineVi' AS headline,
                concat_ws(' ',
                  summary->>'headlineVi',
                  (SELECT string_agg(bullet, ' ')
                   FROM jsonb_array_elements_text(summary->'bulletsVi') AS bullet),
                  (SELECT string_agg(concat_ws(' ', item->>'textVi', item->>'owner'), ' ')
                   FROM jsonb_array_elements(action_items) AS item)
                ) AS debrief_text
              FROM debriefs WHERE debriefs.session_id = s.id ORDER BY version DESC LIMIT 1
            ) d ON true
            ORDER BY s.started_at DESC`;
          if (sessions.length === 0) return { sessions: [], hits: [] };
          const hits = await tx<
            Array<{ session_id: string; id: string; text_en: string; text_vi: string | null }>
          >`
            SELECT segments.session_id, segments.id, segments.text_en, segments.text_vi
            FROM segments
            JOIN sessions ON sessions.id = segments.session_id
            WHERE sessions.user_id = ${userId} AND sessions.id IN ${tx(sessions.map((s) => s.id))}
              AND (lower(segments.text_en) LIKE ANY(${patterns})
                OR lower(segments.text_vi) LIKE ANY(${patterns}))
            ORDER BY sessions.started_at DESC, segments.start_ms
            LIMIT ${PAST_HIT_LIMIT}`;
          return {
            sessions: sessions.map((row) => ({
              id: row.id,
              title: row.title,
              startedAt: row.started_at.toISOString(),
              headline: row.headline,
              debriefText: row.debrief_text ?? '',
            })),
            hits: hits.map((row) => ({
              sessionId: row.session_id,
              segmentId: row.id,
              text: row.text_en,
              translation: row.text_vi,
            })),
          };
        });
      } catch (error) {
        // Earlier meetings are an extra: too slow means answering without them, not failing the question.
        if ((error as { code?: string }).code === QUERY_CANCELED) {
          return { sessions: [], hits: [], timedOut: true };
        }
        throw error;
      }
    },
    async linesAround(userId, sessionId, segmentIds) {
      if (segmentIds.length === 0) return [];
      const rows = await sql<
        Array<{
          text_en: string;
          source: 'system' | 'mic';
          label: string | null;
          display_name: string | null;
        }>
      >`
        WITH ordered AS (
          SELECT segments.id, segments.text_en, segments.source, segments.speaker_id,
            row_number() OVER (ORDER BY segments.start_ms, segments.id) AS n
          FROM segments
          JOIN sessions ON sessions.id = segments.session_id
          WHERE sessions.id = ${sessionId} AND sessions.user_id = ${userId}
            AND sessions.status <> 'deleted'
        )
        SELECT o.text_en, o.source, speakers.label, speakers.display_name
        FROM ordered o
        LEFT JOIN speakers ON speakers.id = o.speaker_id
        WHERE EXISTS (
          SELECT 1 FROM ordered hit WHERE hit.id IN ${sql(segmentIds)} AND o.n BETWEEN hit.n - 1 AND hit.n + 1
        )
        ORDER BY o.n`;
      return rows.map((row) => ({
        speaker: speakerName({
          displayName: row.display_name,
          label: row.label,
          source: row.source,
        }),
        text: row.text_en,
      }));
    },
  };
}
