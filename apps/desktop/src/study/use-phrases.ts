import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studyApi } from './study-api';

const PHRASES_KEY = ['study', 'phrases'] as const;

export function confirmPhraseRemoval(phrase: string, confirm: (message: string) => boolean) {
  return confirm(`Xoá “${phrase}” khỏi danh sách cụm từ?`);
}

export function usePhrases() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: PHRASES_KEY, queryFn: studyApi.getPhrases });
  const remove = useMutation({
    mutationFn: studyApi.removePhrase,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PHRASES_KEY }),
  });

  return {
    phrases: list.data?.phrases ?? [],
    loading: list.isPending,
    listError: list.isError,
    removingId: remove.isPending ? remove.variables : null,
    removeError: remove.isError,
    failedId: remove.isError ? remove.variables : null,
    remove: remove.mutate,
    retryList: list.refetch,
  };
}
