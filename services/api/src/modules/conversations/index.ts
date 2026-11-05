/**
 * Conversations — AI assistant conversations and their messages (list, read, create, rename, soft delete).
 * The turn itself (streaming, tools, quota) lives in `modules/agent`, which writes messages through this repository.
 * Design: apps/docs/docs/04-modules/03-api/conversations.md · Convention: apps/docs/docs/05-engineering/conventions/api-module.md
 */
import { conversationsRoutes } from './conversations.routes';
import { createConversationsService } from './conversations.service';
import type { ConversationsRepository } from './conversations.repository';

export function createConversationsModule(repo: ConversationsRepository) {
  const service = createConversationsService(repo);
  return { service, routes: conversationsRoutes(service) };
}

export type { ConversationsRepository, MessagePatch } from './conversations.repository';
export type { ConversationsService } from './conversations.service';
export { createPostgresConversationsRepository } from './conversations.repository';
export { createInMemoryConversationsRepository } from './conversations.repository.memory';
