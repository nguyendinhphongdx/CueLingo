import { ApiError } from '@cuelingo/core-sdk';
import type { AdminSetUserPlanRequest } from '@cuelingo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';
import { isAuthRefusal } from './admin-users-format';

const key = (id: string) => ['admin', 'users', 'detail', id] as const;

export function useAdminUser(id: string) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: key(id), queryFn: () => client.admin.users.get(id) });
  const save = useMutation({
    mutationFn: (input: AdminSetUserPlanRequest) => client.admin.users.setPlan(id, input),
    // The plan shows in the dashboard counts, the list rows and this page.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
      ]),
  });
  const status = query.error instanceof ApiError ? query.error.status : null;
  return {
    detail: query.data ?? null,
    loading: query.isPending,
    hidden: status !== null && isAuthRefusal(status),
    missing: status === 404,
    error:
      status !== null && (isAuthRefusal(status) || status === 404)
        ? null
        : describeError(query.error),
    save: save.mutate,
    saving: save.isPending,
    saved: save.isSuccess,
    saveError: describeError(save.error),
    resetSave: save.reset,
  };
}
