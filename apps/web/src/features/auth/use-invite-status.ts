import { useQuery } from '@tanstack/react-query';
import { client } from '../../lib/client';

/**
 * Whether a new account needs an invite code. Asks for the code while the answer is unknown or the API
 * cannot be reached: an extra optional field is better than a sign-up that fails without one.
 */
export function useInvitesRequired(): boolean {
  const query = useQuery({
    queryKey: ['invite-status'],
    queryFn: () => client.invites.status(),
    staleTime: 5 * 60_000,
    retry: false,
  });
  return query.data?.required ?? true;
}
