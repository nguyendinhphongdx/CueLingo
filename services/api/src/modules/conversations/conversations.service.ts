import {
  DEFAULT_LANGUAGE,
  ErrorCode,
  type Conversation,
  type ConversationDetail,
  type CreateConversationRequest,
} from '@cuelingo/shared';
import { AppError } from '../../lib/errors';
import type { ConversationsRepository } from './conversations.repository';

export type ConversationsService = ReturnType<typeof createConversationsService>;

const notFound = () => new AppError(ErrorCode.NotFound, 'Conversation not found');

/** Business rules for conversations. Someone else's conversation is "not found", never "forbidden". */
export function createConversationsService(repo: ConversationsRepository) {
  return {
    list(userId: string): Promise<Conversation[]> {
      return repo.list(userId);
    },

    async get(userId: string, id: string): Promise<ConversationDetail> {
      const detail = await repo.get(userId, id);
      if (!detail) throw notFound();
      return detail;
    },

    create(userId: string, input: CreateConversationRequest): Promise<Conversation> {
      return repo.create(userId, input.language ?? DEFAULT_LANGUAGE);
    },

    async rename(userId: string, id: string, title: string): Promise<Conversation> {
      const renamed = await repo.rename(userId, id, title);
      if (!renamed) throw notFound();
      return renamed;
    },

    async remove(userId: string, id: string): Promise<void> {
      if (!(await repo.softDelete(userId, id))) throw notFound();
    },
  };
}
