import { useQuery } from '@tanstack/react-query';
import { client } from '../../lib/client';

/**
 * Whether to show the admin group. Kept in memory only (TanStack Query, 5 minutes), never in localStorage, and
 * false until the API has answered, so a stranger never sees the group flash. An error counts as "not admin".
 */
export function useIsAdmin(enabled: boolean): boolean {
  const query = useQuery({
    queryKey: ['admin', 'access'],
    queryFn: client.admin.access,
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return query.data?.isAdmin === true;
}
