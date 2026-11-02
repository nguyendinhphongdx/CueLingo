import type { CreateGlossaryTermInput, LanguageCode } from '@cuelingo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

const GLOSSARY_ROOT = ['glossary'] as const;

/** State + actions for the glossary screen. UI components stay free of API calls. */
export function useGlossary(language: LanguageCode) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: GLOSSARY_ROOT });

  const list = useQuery({
    queryKey: [...GLOSSARY_ROOT, language],
    queryFn: () => client.glossary.list(language),
  });
  const add = useMutation({
    mutationFn: (input: Omit<CreateGlossaryTermInput, 'language'>) =>
      client.glossary.create({ ...input, language }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => client.glossary.remove(id),
    onSuccess: refresh,
  });

  return {
    items: list.data ?? [],
    loading: list.isPending,
    error: describeError(list.error) ?? describeError(add.error) ?? describeError(remove.error),
    adding: add.isPending,
    add: add.mutateAsync,
    remove: remove.mutate,
  };
}
