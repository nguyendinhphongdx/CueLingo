import { ApiError } from '@cuelingo/core-sdk';
import type { AdminUsageMetric, AdminUserListQuery, Plan } from '@cuelingo/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';
import { isAuthRefusal } from './admin-users-format';

/** The one filter control: a plan, or "ending soon". */
export type PlanFilter = 'all' | Plan | 'expiring';

/** "At least 80% / 100% of this month's limit of one metric": set by the links on the usage page. */
export interface QuotaFilter {
  metric: AdminUsageMetric;
  atLeast: '80' | '100';
}

export interface UserFilters {
  q: string;
  plan: PlanFilter;
  quota?: QuotaFilter | null;
}

/** What the API takes for these filters. Empty text and "all" send nothing. */
export function queryFor({ q, plan, quota }: UserFilters): AdminUserListQuery {
  const query: AdminUserListQuery = {};
  const text = q.trim();
  if (text) query.q = text;
  if (plan === 'expiring') query.expiring = '1';
  else if (plan !== 'all') query.plan = plan;
  if (quota) {
    query.metric = quota.metric;
    query.atLeast = quota.atLeast;
  }
  return query;
}

export { useDebounced } from '../../lib/use-debounced';

const refused = (error: unknown) => error instanceof ApiError && isAuthRefusal(error.status);

export function useAdminDashboard() {
  const query = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: client.admin.dashboard });
  return {
    dashboard: query.data ?? null,
    loading: query.isPending,
    hidden: refused(query.error),
    error: refused(query.error) ? null : describeError(query.error),
  };
}

/** People, 50 at a time, "load more" through the cursor. The filters are part of the cache key. */
export function useAdminUsers(filters: UserFilters) {
  const query = queryFor(filters);
  const list = useInfiniteQuery({
    queryKey: ['admin', 'users', 'list', query],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => client.admin.users.list({ ...query, cursor: pageParam }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  return {
    users: list.data?.pages.flatMap((page) => page.items) ?? [],
    loading: list.isPending,
    ready: list.isSuccess,
    hidden: refused(list.error),
    error: refused(list.error) ? null : describeError(list.error),
    hasMore: list.hasNextPage,
    loadingMore: list.isFetchingNextPage,
    loadMore: () => void list.fetchNextPage(),
  };
}
