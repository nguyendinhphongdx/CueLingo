import { randomUUID } from 'node:crypto';
import type { Conversation, LanguageCode, Message } from '@cuelingo/shared';
import {
  LIST_LIMIT,
  MAX_MESSAGES_PER_READ,
  STALE_STREAMING_MS,
  TITLE_FROM_MESSAGE_CHARS,
  type ConversationsRepository,
} from './conversations.repository';

interface ConversationRow extends Conversation {
  userId: string;
  deletedAt: string | null;
}
type MessageRow = Message & { userId: string };

/** In-memory implementation with the same contract, for tests and local demos. */
export function createInMemoryConversationsRepository(
  now: () => Date = () => new Date(),
): ConversationsRepository {
  const conversations: ConversationRow[] = [];
  const messages: MessageRow[] = [];

  const alive = (userId: string, id: string) =>
    conversations.find((c) => c.userId === userId && c.id === id && c.deletedAt === null);
  const toConversation = ({ userId: _u, deletedAt: _d, ...c }: ConversationRow): Conversation => c;
  const toMessage = ({ userId: _u, ...m }: MessageRow): Message => ({
    ...m,
    parts: m.parts.map((p) => ({ ...p })),
    status:
      m.status === 'streaming' && now().getTime() - Date.parse(m.createdAt) > STALE_STREAMING_MS
        ? 'error'
        : m.status,
  });

  function insert(
    userId: string,
    conversationId: string,
    role: Message['role'],
    parts: Message['parts'],
    status: Message['status'],
  ): Message | null {
    if (!alive(userId, conversationId)) return null;
    const seq = messages.filter((m) => m.conversationId === conversationId).length;
    const row: MessageRow = {
      id: randomUUID(),
      conversationId,
      seq,
      role,
      parts,
      status,
      createdAt: now().toISOString(),
      userId,
    };
    messages.push(row);
    return toMessage(row);
  }

  return {
    async list(userId) {
      return conversations
        .filter((c) => c.userId === userId && c.deletedAt === null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, LIST_LIMIT)
        .map(toConversation);
    },
    async get(userId, id) {
      const row = alive(userId, id);
      if (!row) return null;
      return {
        conversation: toConversation(row),
        messages: messages
          .filter((m) => m.userId === userId && m.conversationId === id)
          .sort((a, b) => a.seq - b.seq)
          .slice(0, MAX_MESSAGES_PER_READ)
          .map(toMessage),
      };
    },
    async create(userId, language: LanguageCode) {
      const stamp = now().toISOString();
      const row: ConversationRow = {
        id: randomUUID(),
        title: '',
        language,
        createdAt: stamp,
        updatedAt: stamp,
        userId,
        deletedAt: null,
      };
      conversations.push(row);
      return toConversation(row);
    },
    async rename(userId, id, title) {
      const row = alive(userId, id);
      if (!row) return null;
      row.title = title;
      row.updatedAt = now().toISOString();
      return toConversation(row);
    },
    async softDelete(userId, id) {
      const row = alive(userId, id);
      if (!row) return false;
      row.deletedAt = now().toISOString();
      return true;
    },
    async appendUserMessage(userId, conversationId, text) {
      const message = insert(userId, conversationId, 'user', [{ type: 'text', text }], 'complete');
      const row = alive(userId, conversationId);
      if (message && row) {
        if (row.title === '') {
          row.title = text.replace(/\s+/g, ' ').trim().slice(0, TITLE_FROM_MESSAGE_CHARS);
        }
        row.updatedAt = now().toISOString();
      }
      return message;
    },
    async beginAssistantMessage(userId, conversationId) {
      return insert(userId, conversationId, 'assistant', [], 'streaming');
    },
    async updateMessage(userId, messageId, patch) {
      const row = messages.find((m) => m.userId === userId && m.id === messageId);
      if (!row) return false;
      if (patch.parts) row.parts = patch.parts;
      if (patch.status) row.status = patch.status;
      const conversation = conversations.find((c) => c.id === row.conversationId);
      if (conversation) conversation.updatedAt = now().toISOString();
      return true;
    },
    async countUserMessagesSince(userId, since) {
      return messages.filter(
        (m) =>
          m.userId === userId && m.role === 'user' && Date.parse(m.createdAt) >= since.getTime(),
      ).length;
    },
  };
}
