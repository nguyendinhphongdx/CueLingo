import type { LanguageCode } from '@cuelingo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studyApi } from './study-api';

export function confirmPhraseRemoval(phrase: string, confirm: (message: string) => boolean) {
  return confirm(`Xoá “${phrase}” khỏi danh sách cụm từ?`);
}

const PHRASES_ROOT = ['study', 'phrases'] as const;

export function usePhrases(language: LanguageCode) {
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: [...PHRASES_ROOT, language],
    queryFn: () => studyApi.getPhrases(language),
  });
  const remove = useMutation({
    mutationFn: studyApi.removePhrase,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PHRASES_ROOT }),
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
