import { DEFAULT_USER_SETTINGS, type LanguageCode, type UserSettings } from '@cuelingo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '../../lib/client';
import { describeError } from '../../lib/errors';

export function usePreferences(language: LanguageCode) {
  const queryClient = useQueryClient();
  const SETTINGS_KEY = ['settings', language] as const;
  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => client.settings.get(language),
  });
  const update = useMutation({
    mutationFn: (settings: UserSettings) => client.settings.update(settings, language),
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
