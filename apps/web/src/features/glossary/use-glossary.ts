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

  /** Adds one term after another and reports how many went in; stops at the first error (shown as `error`). */
  const addMany = async (entries: Omit<CreateGlossaryTermInput, 'language'>[]) => {
    let added = 0;
    try {
      for (const entry of entries) {
        await add.mutateAsync(entry);
        added += 1;
      }
    } catch {
      // `add.error` carries the message.
    }
    return added;
  };

  return {
    items: list.data ?? [],
    loading: list.isPending,
    error: describeError(list.error) ?? describeError(add.error) ?? describeError(remove.error),
    adding: add.isPending,
    add: add.mutateAsync,
    addMany,
    remove: remove.mutate,
  };
}
