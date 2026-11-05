import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

export const CONVERSATIONS_KEY = ['conversations'] as const;

/** The person's conversations, and renaming and deleting them. */
export function useConversations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });

  const list = useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () => client.conversations.list(),
  });
  const rename = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      client.conversations.rename(id, title),
    onSuccess: (conversation) => {
      void refresh();
      void queryClient.invalidateQueries({ queryKey: ['conversation', conversation.id] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => client.conversations.remove(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: ['conversation', id] });
      void refresh();
    },
  });

  return {
    conversations: list.data ?? [],
    loading: list.isPending,
    error: describeError(list.error) ?? describeError(rename.error) ?? describeError(remove.error),
    renaming: rename.isPending,
    rename: rename.mutateAsync,
    removing: remove.isPending,
    remove: remove.mutateAsync,
  };
}
