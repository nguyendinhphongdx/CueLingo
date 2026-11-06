import { ApiError } from '@cuelingo/core-sdk';
import type { UpdateAdminAgentRequest } from '@cuelingo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

const KEY = ['admin', 'agent'] as const;

export function useAdminAgent() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: client.admin.agent.get });
  const update = useMutation({
    mutationFn: (input: UpdateAdminAgentRequest) => client.admin.agent.update(input),
    // The API answers with the new status, so no second round trip.
    onSuccess: (status) => queryClient.setQueryData(KEY, status),
  });
  const hidden =
    query.error instanceof ApiError && (query.error.status === 401 || query.error.status === 403);
  return {
    status: query.data ?? null,
    loading: query.isPending,
    hidden,
    error: hidden ? null : describeError(query.error ?? update.error),
    saving: update.isPending,
    setEnabled: (enabled: boolean) => update.mutate({ enabled }),
    setPlugin: (id: string, enabled: boolean) => update.mutate({ plugin: { id, enabled } }),
  };
}
