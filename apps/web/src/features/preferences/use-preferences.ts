import { DEFAULT_USER_SETTINGS, type UserSettings } from '@cuelingo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

const SETTINGS_KEY = ['settings'] as const;

export function usePreferences() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: client.settings.get });
  const update = useMutation({
    mutationFn: (settings: UserSettings) => client.settings.update(settings),
    onSuccess: (settings) => queryClient.setQueryData(SETTINGS_KEY, settings),
  });

  return {
    settings: query.data ?? DEFAULT_USER_SETTINGS,
    loading: query.isPending,
    saving: update.isPending,
    saved: update.isSuccess,
    error: describeError(query.error) ?? describeError(update.error),
    save: update.mutateAsync,
    resetStatus: update.reset,
  };
}
