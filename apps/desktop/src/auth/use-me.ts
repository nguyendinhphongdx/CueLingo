import { useQuery } from '@tanstack/react-query';
import { currentToken, useAuthStore } from './auth-store';
import { describeMeError, meApi } from './me-api';

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
    retry: 1,
  });

  return {
    me: query.data ?? null,
    loading: enabled && query.isPending,
    error: query.error ? describeMeError(query.error) : null,
  };
}
