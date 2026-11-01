import { useQuery } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

export function useProgress() {
  const query = useQuery({ queryKey: ['progress'], queryFn: client.progress });
  return {
    progress: query.data ?? null,
    loading: query.isPending,
    error: describeError(query.error),
  };
}
