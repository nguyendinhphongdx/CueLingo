import type { Session, SessionDetail } from '@cuelingo/shared';
import { SEARCH_SCOPE } from '@cuelingo/ui/lib/meeting-search';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { sessionsApi } from './sessions-api';

/**
 * The text of the newest meetings, read one request each (the API has no search endpoint yet). Only runs while
 * `enabled`; a meeting that fails to load is skipped. Text lives in the query cache and is never logged.
 */
export function useMeetingText(sessions: Session[], enabled: boolean) {
  const readable = sessions.filter((session) => session.status !== 'live');
  const scope = [...readable]
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
    .slice(0, SEARCH_SCOPE);
  const results = useQueries({
    queries: scope.map((session) => ({
      queryKey: ['session-detail', session.id],
      queryFn: () => sessionsApi.get(session.id),
      enabled,
      staleTime: 60_000,
      retry: false,
    })),
  });
  // `results` is a new array every render; the map only changes when a query's data does.
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
    /** Meetings left out because the search reads only the newest ones. */
    skipped: Math.max(0, readable.length - scope.length),
  };
}
