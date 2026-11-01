import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

const PHRASES_KEY = ['phrases'] as const;

export function usePhrases() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: PHRASES_KEY, queryFn: client.phrases.list });
  const remove = useMutation({
    mutationFn: client.phrases.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PHRASES_KEY }),
  });
  return {
    phrases: list.data?.phrases ?? [],
    loading: list.isPending,
    removingId: remove.isPending ? remove.variables : null,
    error: describeError(list.error) ?? describeError(remove.error),
    remove: remove.mutate,
  };
}
