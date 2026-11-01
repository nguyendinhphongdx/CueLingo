import { useQuery } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

export function useSessions() {
  const query = useQuery({
    queryKey: ['sessions'],
    queryFn: () => client.sessions.list(),
  });

  return {
    sessions: query.data?.sessions ?? [],
    loading: query.isPending,
    error: describeError(query.error),
  };
}
