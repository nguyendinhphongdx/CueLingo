import { ApiError } from '@cuelingo/core-sdk';
import { useQuery } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

export function useAdminMetrics() {
  const query = useQuery({ queryKey: ['admin', 'metrics'], queryFn: client.admin.metrics });
  const hidden =
    query.error instanceof ApiError && (query.error.status === 401 || query.error.status === 403);
  return {
    metrics: query.data ?? null,
    loading: query.isPending,
    hidden,
    error: hidden ? null : describeError(query.error),
  };
}
