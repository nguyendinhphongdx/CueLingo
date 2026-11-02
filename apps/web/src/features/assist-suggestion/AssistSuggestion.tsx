'use client';

import { AssistSuggestionCard } from '@cuelingo/ui/components/assist-suggestion-card';
import type { LanguageCode } from '@cuelingo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '../../lib/client';

/**
 * Offers to change the assist level when the last meetings say it may be time. Either answer is
 * recorded (it starts the server's quiet week); accepting also changes the default level.
 */
export function AssistSuggestion({ language }: { language: LanguageCode }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['assist-suggestion', language],
    queryFn: () => client.assist.suggestion(language),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const answer = useMutation({
    mutationFn: async (action: 'applied' | 'dismissed') => {
      const suggestion = query.data;
      if (!suggestion || suggestion.kind === 'keep') return;
      if (action === 'applied') {
        await client.settings.update({ assistDefault: suggestion.suggestedLevel }, language);
      }
      await client.events.record({
        type: 'assist_suggestion',
        action,
        language,
        level: action === 'applied' ? suggestion.suggestedLevel : suggestion.currentLevel,
        at: new Date().toISOString(),
      });
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['assist-suggestion', language] }),
        queryClient.invalidateQueries({ queryKey: ['settings'] }),
      ]),
  });

  const suggestion = query.data;
  if (!suggestion || suggestion.kind === 'keep') return null;

  return (
    <AssistSuggestionCard
      suggestion={suggestion}
      busy={answer.isPending}
      onApply={() => answer.mutate('applied')}
      onLater={() => answer.mutate('dismissed')}
    />
  );
}
