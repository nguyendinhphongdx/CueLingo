import {
  ConversationDetailSchema,
  ConversationListSchema,
  ConversationSchema,
  CreateConversationRequestSchema,
  RenameConversationRequestSchema,
  type Conversation,
  type ConversationDetail,
  type CreateConversationRequest,
} from '@cuelingo/shared';
import type { Http } from './http';

const path = (id: string) => `/v1/conversations/${encodeURIComponent(id)}`;

/** Assistant conversations of the signed-in user. A turn itself is `agent.sendMessage`. */
export function conversationsApi(http: Http) {
  return {
    async list(): Promise<Conversation[]> {
      return (await http.request('GET', '/v1/conversations', ConversationListSchema)).items;
    },
    get(id: string): Promise<ConversationDetail> {
      return http.request('GET', path(id), ConversationDetailSchema);
    },
    create(input: CreateConversationRequest = {}): Promise<Conversation> {
      return http.request(
        'POST',
        '/v1/conversations',
        ConversationSchema,
        CreateConversationRequestSchema.parse(input),
      );
    },
    rename(id: string, title: string): Promise<Conversation> {
      return http.request(
        'PATCH',
        path(id),
        ConversationSchema,
        RenameConversationRequestSchema.parse({ title }),
      );
    },
    async remove(id: string): Promise<void> {
      await http.request('DELETE', path(id), null);
    },
  };
}
