import { useQuery } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

/** The signed-in user's plan and allowances. UI components stay free of API calls. */
export function useUsage() {
  const query = useQuery({
    queryKey: ['usage'],
    queryFn: () => client.usage.get(),
  });
  return {
    usage: query.data,
    loading: query.isPending,
    error: describeError(query.error),
  };
}
