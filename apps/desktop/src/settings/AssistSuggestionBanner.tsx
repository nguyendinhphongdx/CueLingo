import { AssistSuggestionCard } from '@cuelingo/ui/components/assist-suggestion-card';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assistApi } from '../quick-assist/assist-api';
import { dialApi } from './dial-api';
import { queueSettingsPatch } from './settings-api';
import { useSettings, type SelectableAssistLevel } from './settings-store';
import { saveAssistLevel } from './use-assist-settings';
import { useLearnLanguage } from './use-language';

/**
 * Offers to change the assist level when the last meetings say it may be time. Either answer is
 * recorded, which starts the quiet week on the server; accepting also changes the level everywhere.
 */
export function AssistSuggestionBanner() {
  const client = useQueryClient();
  const setLevel = useSettings((state) => state.setAssistLevel);
  const { language } = useLearnLanguage();
  const query = useQuery({
    queryKey: ['assist-suggestion', language],
    queryFn: () => dialApi.suggestion(language),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const answer = useMutation({
    mutationFn: async (action: 'applied' | 'dismissed') => {
      const suggestion = query.data;
      if (!suggestion || suggestion.kind === 'keep') return;
      const level = suggestion.suggestedLevel as SelectableAssistLevel;
      if (action === 'applied') {
        await saveAssistLevel(level);
        setLevel(level);
        queueSettingsPatch({ assistDefault: level });
      }
      await assistApi.record({
        type: 'assist_suggestion',
        action,
        language,
        level: action === 'applied' ? level : (suggestion.currentLevel as SelectableAssistLevel),
        at: new Date().toISOString(),
      });
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['assist-suggestion', language] }),
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
