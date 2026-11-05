import {
  type Conversation,
  type ConversationDetail,
  type LanguageCode,
  type Message,
  type MessagePart,
  type MessageStatus,
} from '@cuelingo/shared';
import type { Sql } from '../../lib/db';

/** A conversation keeps at most this many messages in a read; a turn never gets near it. */
export const MAX_MESSAGES_PER_READ = 500;
export const LIST_LIMIT = 100;
/** The title is the first characters of the first message (plan, "Giả định"). */
export const TITLE_FROM_MESSAGE_CHARS = 60;
/** A message still `streaming` after this long belongs to a process that died; it is read as `error`. */
export const STALE_STREAMING_MS = 10 * 60 * 1000;

export interface MessagePatch {
  parts?: MessagePart[];
  status?: MessageStatus;
  promptVersion?: string;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Data access for conversations and their messages. Every method is scoped by the authenticated user's id and
 * ignores soft-deleted conversations; a conversation of someone else is simply "not found".
 */
export interface ConversationsRepository {
  list(userId: string): Promise<Conversation[]>;
  /** The conversation with its messages, oldest first. */
  get(userId: string, id: string): Promise<ConversationDetail | null>;
  create(userId: string, language: LanguageCode): Promise<Conversation>;
  rename(userId: string, id: string, title: string): Promise<Conversation | null>;
  /** Hides the conversation at once; retention removes it for good later. */
  softDelete(userId: string, id: string): Promise<boolean>;
  /** Stores the user's message and, if the conversation has no title yet, names it after the message. */
  appendUserMessage(userId: string, conversationId: string, text: string): Promise<Message | null>;
  /** Stores an empty assistant message in `streaming`; the turn fills it in. */
  beginAssistantMessage(userId: string, conversationId: string): Promise<Message | null>;
  updateMessage(userId: string, messageId: string, patch: MessagePatch): Promise<boolean>;
  /** Messages the user sent since `since`: one per turn, for the daily quota. */
  countUserMessagesSince(userId: string, since: Date): Promise<number>;
}

interface ConversationRow {
  id: string;
  title: string;
  language: LanguageCode;
  created_at: Date;
  updated_at: Date;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  seq: number;
  role: Message['role'];
  parts: MessagePart[];
  status: MessageStatus;
  created_at: Date;
}

const toConversation = (row: ConversationRow): Conversation => ({
  id: row.id,
  title: row.title,
  language: row.language,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const toMessage = (row: MessageRow): Message => ({
  id: row.id,
  conversationId: row.conversation_id,
  seq: row.seq,
  role: row.role,
  parts: row.parts,
  status: row.status,
  createdAt: row.created_at.toISOString(),
});

export function createPostgresConversationsRepository(sql: Sql): ConversationsRepository {
  async function insertMessage(
    userId: string,
    conversationId: string,
    role: Message['role'],
    parts: MessagePart[],
    status: MessageStatus,
  ): Promise<Message | null> {
    // One statement: the conversation must be the user's and alive, and `seq` follows the last message.
    const [row] = await sql<MessageRow[]>`
      INSERT INTO agent_messages (conversation_id, user_id, seq, role, parts, status)
      SELECT c.id, c.user_id,
             COALESCE((SELECT max(m.seq) + 1 FROM agent_messages m WHERE m.conversation_id = c.id), 0),
             ${role}, ${sql.json(parts)}, ${status}
      FROM agent_conversations c
      WHERE c.id = ${conversationId} AND c.user_id = ${userId} AND c.deleted_at IS NULL
      RETURNING id, conversation_id, seq, role, parts, status, created_at`;
    return row ? toMessage(row) : null;
  }

  return {
    async list(userId) {
      const rows = await sql<ConversationRow[]>`
        SELECT id, title, language, created_at, updated_at FROM agent_conversations
        WHERE user_id = ${userId} AND deleted_at IS NULL
        ORDER BY updated_at DESC LIMIT ${LIST_LIMIT}`;
      return rows.map(toConversation);
    },

    async get(userId, id) {
      const [conversation] = await sql<ConversationRow[]>`
        SELECT id, title, language, created_at, updated_at FROM agent_conversations
        WHERE user_id = ${userId} AND id = ${id} AND deleted_at IS NULL`;
      if (!conversation) return null;
      const staleBefore = new Date(Date.now() - STALE_STREAMING_MS);
      const messages = await sql<MessageRow[]>`
        SELECT * FROM (
          SELECT id, conversation_id, seq, role, parts, created_at,
            CASE WHEN status = 'streaming' AND created_at < ${staleBefore} THEN 'error' ELSE status END AS status
          FROM agent_messages
          WHERE user_id = ${userId} AND conversation_id = ${id}
          ORDER BY seq DESC LIMIT ${MAX_MESSAGES_PER_READ}
        ) newest ORDER BY seq`;
      return { conversation: toConversation(conversation), messages: messages.map(toMessage) };
    },

    async create(userId, language) {
      const [row] = await sql<ConversationRow[]>`
        INSERT INTO agent_conversations (user_id, language) VALUES (${userId}, ${language})
        RETURNING id, title, language, created_at, updated_at`;
      return toConversation(row!);
    },

    async rename(userId, id, title) {
      const [row] = await sql<ConversationRow[]>`
        UPDATE agent_conversations SET title = ${title}, updated_at = now()
        WHERE user_id = ${userId} AND id = ${id} AND deleted_at IS NULL
        RETURNING id, title, language, created_at, updated_at`;
      return row ? toConversation(row) : null;
    },

    async softDelete(userId, id) {
      const result = await sql`
        UPDATE agent_conversations SET deleted_at = now()
        WHERE user_id = ${userId} AND id = ${id} AND deleted_at IS NULL`;
      return result.count > 0;
    },

    async appendUserMessage(userId, conversationId, text) {
      const message = await insertMessage(
        userId,
        conversationId,
        'user',
        [{ type: 'text', text }],
        'complete',
      );
      if (message) {
        await sql`
          UPDATE agent_conversations SET
            title = CASE WHEN title = '' THEN ${text.replace(/\s+/g, ' ').trim().slice(0, TITLE_FROM_MESSAGE_CHARS)} ELSE title END,
            updated_at = now()
          WHERE id = ${conversationId} AND user_id = ${userId}`;
      }
      return message;
    },

    beginAssistantMessage(userId, conversationId) {
      return insertMessage(userId, conversationId, 'assistant', [], 'streaming');
    },

    async updateMessage(userId, messageId, patch) {
      const result = await sql`
        UPDATE agent_messages SET
          parts = ${patch.parts ? sql.json(patch.parts) : sql`parts`},
          status = COALESCE(${patch.status ?? null}, status),
          prompt_version = COALESCE(${patch.promptVersion ?? null}, prompt_version),
          input_tokens = COALESCE(${patch.inputTokens ?? null}, input_tokens),
          output_tokens = COALESCE(${patch.outputTokens ?? null}, output_tokens)
        WHERE user_id = ${userId} AND id = ${messageId}`;
      if (result.count > 0) {
        await sql`
          UPDATE agent_conversations SET updated_at = now()
          WHERE user_id = ${userId}
            AND id = (SELECT conversation_id FROM agent_messages WHERE id = ${messageId} AND user_id = ${userId})`;
      }
      return result.count > 0;
    },

    async countUserMessagesSince(userId, since) {
      const [row] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM agent_messages
        WHERE user_id = ${userId} AND role = 'user' AND created_at >= ${since}`;
      return row?.count ?? 0;
    },
  };
}
