import { useQuery } from '@tanstack/react-query';
import { currentToken, useAuthStore } from './auth-store';
import { describeMeError, isUnauthorized, meApi } from './me-api';

/**
 * Who is using the app on this device. Works for a signed-in device token and for the development
 * token alike, and reloads when somebody signs in or out.
 */
export function useMe() {
  const token = useAuthStore((state) => state.token);
  const enabled = currentToken() !== '';
  const query = useQuery({
    queryKey: ['me', token ?? 'dev'],
    queryFn: () => meApi.get(),
    enabled,
    staleTime: 60_000,
    // Never retry a rejected token, and never refetch a failed load just because another component mounted:
    // the app shell itself uses this query, so a refetch on mount would put it back into loading for ever.
    retry: (failures, error) => !isUnauthorized(error) && failures < 1,
    retryOnMount: false,
  });

  return {
    me: query.data ?? null,
    loading: enabled && query.isPending,
    error: query.error ? describeMeError(query.error) : null,
    unauthorized: isUnauthorized(query.error),
  };
}
