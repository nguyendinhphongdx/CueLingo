import type { CreateGlossaryTermInput } from '@cuelingo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

const GLOSSARY_KEY = ['glossary'] as const;

/** State + actions for the glossary screen. UI components stay free of API calls. */
export function useGlossary() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: GLOSSARY_KEY });

  const list = useQuery({ queryKey: GLOSSARY_KEY, queryFn: () => client.glossary.list() });
  const add = useMutation({
    mutationFn: (input: CreateGlossaryTermInput) => client.glossary.create(input),
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
