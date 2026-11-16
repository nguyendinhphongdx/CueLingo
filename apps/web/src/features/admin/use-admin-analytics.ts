import { ApiError } from '@cuelingo/core-sdk';
import { useQuery } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';
import { isAuthRefusal } from './admin-users-format';

function useAnalytics<T>(kind: string, fetcher: () => Promise<T>) {
  const query = useQuery({ queryKey: ['admin', 'analytics', kind], queryFn: () => fetcher() });
  const hidden = query.error instanceof ApiError && isAuthRefusal(query.error.status);
  return {
    data: query.data ?? null,
    loading: query.isPending,
    /** 401/403: the page answers 404 as if it did not exist. */
    hidden,
    error: hidden || !query.error ? null : describeError(query.error),
    reload: () => void query.refetch(),
    reloading: query.isFetching && !query.isPending,
  };
}

export const useAdminOverview = () => useAnalytics('overview', client.admin.analytics.overview);
export const useAdminRevenue = () => useAnalytics('revenue', client.admin.analytics.revenue);
export const useAdminUsage = () => useAnalytics('usage', client.admin.analytics.usage);
export const useAdminActivity = () => useAnalytics('activity', client.admin.analytics.activity);
