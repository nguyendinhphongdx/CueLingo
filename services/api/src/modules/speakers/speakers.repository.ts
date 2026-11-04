import type { Speaker, SpeakerLabel } from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

/** Data access for the people of a meeting. Every method joins the session and filters by its owner. */
export interface SpeakersRepository {
  find(userId: string, sessionId: string, speakerId: string): Promise<Speaker | null>;
  rename(
    userId: string,
    sessionId: string,
    speakerId: string,
    displayName: string | null,
  ): Promise<Speaker | null>;
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

export function createPostgresSpeakersRepository(sql: Sql): SpeakersRepository {
  return {
    async find(userId, sessionId, speakerId) {
      const [row] = await sql<SpeakerRow[]>`
        SELECT speakers.id, speakers.label, speakers.display_name
        FROM speakers JOIN sessions ON sessions.id = speakers.session_id
        WHERE sessions.user_id = ${userId} AND sessions.id = ${sessionId}
          AND sessions.status <> 'deleted' AND speakers.id = ${speakerId}`;
      return row ? toSpeaker(row) : null;
    },
    async rename(userId, sessionId, speakerId, displayName) {
      const [row] = await sql<SpeakerRow[]>`
        UPDATE speakers SET display_name = ${displayName}
        FROM sessions
        WHERE sessions.id = speakers.session_id AND sessions.user_id = ${userId}
          AND sessions.id = ${sessionId} AND sessions.status <> 'deleted'
          AND speakers.id = ${speakerId} AND speakers.label <> 'me'
        RETURNING speakers.id, speakers.label, speakers.display_name`;
      return row ? toSpeaker(row) : null;
    },
  };
}
