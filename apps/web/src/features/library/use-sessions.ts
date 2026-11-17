import type { Session, SessionDetail } from '@cuelingo/shared';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';
import { SEARCH_SCOPE } from '@cuelingo/ui/lib/meeting-search';

const NO_SESSIONS: Session[] = [];

export function useSessions() {
  const query = useQuery({
    queryKey: ['sessions'],
    queryFn: () => client.sessions.list(),
  });

  return {
    // A stable array while the data is unchanged, so the memos that depend on it do not rerun every render.
    sessions: query.data?.sessions ?? NO_SESSIONS,
    loading: query.isPending,
    error: describeError(query.error),
  };
}

/**
 * The text of the newest meetings, read through the same cache key as the meeting page. Only runs while
 * `enabled` (a search or a speaker filter is in use); a meeting that fails to load is skipped.
 */
export function useSessionText(sessions: Session[], enabled: boolean) {
  const scope = [...sessions]
    .filter((session) => session.status !== 'live')
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
    .slice(0, SEARCH_SCOPE);
  const results = useQueries({
    queries: scope.map((session) => ({
      queryKey: ['sessions', session.id],
      queryFn: () => client.sessions.get(session.id),
      enabled,
      staleTime: 60_000,
      retry: false,
    })),
  });
  // `results` is a new array every render; the details only change when a query's data does.
  const stamp = results.map((result) => result.dataUpdatedAt).join('|');
  const scopeKey = scope.map((session) => session.id).join('|');
  const details = useMemo(() => {
    const map = new Map<string, SessionDetail>();
    results.forEach((result, index) => {
      if (result.data) map.set(scope[index]!.id, result.data);
    });
    return map;
  }, [stamp, scopeKey]);
  return {
    details,
    reading: enabled && results.some((result) => result.isPending),
    /** How many meetings were left out because the search reads only the newest ones. */
    skipped: Math.max(0, sessions.filter((s) => s.status !== 'live').length - scope.length),
  };
}
