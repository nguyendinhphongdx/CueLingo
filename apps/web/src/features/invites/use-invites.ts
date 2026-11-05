import { ApiError } from '@cuelingo/core-sdk';
import type { CreateInviteInput } from '@cuelingo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

const KEY = ['admin', 'invites'] as const;

export function useInvites() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: KEY, queryFn: client.admin.invites.list });
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: (input: CreateInviteInput) => client.admin.invites.create(input),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => client.admin.invites.revoke(id),
    onSuccess: refresh,
  });

  const hidden =
    list.error instanceof ApiError && (list.error.status === 401 || list.error.status === 403);
  return {
    invites: list.data?.items ?? [],
    loading: list.isPending,
    hidden,
    error: hidden ? null : describeError(list.error ?? create.error ?? revoke.error),
    create: create.mutate,
    creating: create.isPending,
    /** The plain code of the invite just created. It is shown once and never fetched again. */
    created: create.data ?? null,
    dismissCreated: create.reset,
    revoke: revoke.mutate,
  };
}
