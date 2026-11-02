import type { LanguageCode } from '@cuelingo/shared';
import { useQuery } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

export function useProgress(language: LanguageCode) {
  const query = useQuery({
    queryKey: ['progress', language],
    queryFn: () => client.progress(language),
  });
  return {
    progress: query.data ?? null,
    loading: query.isPending,
    error: describeError(query.error),
  };
}
