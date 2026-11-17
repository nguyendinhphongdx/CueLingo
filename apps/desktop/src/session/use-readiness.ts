import type { LanguageCode } from '@cuelingo/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { native } from '../lib/native';
import { describeReadiness, type ReadinessFix, type ReadinessItem } from './readiness';
import { useLocalModels } from '../models/use-local-models';
import { useModelProgress } from './model-progress';

/** Readiness of microphone, system audio and the speech model, plus what each fix button does. */
export function useReadiness(language: LanguageCode, retry: () => void) {
  const permissions = useQuery({
    queryKey: ['desktop-permissions'],
    queryFn: native.permissionsStatus,
    // Coming back from System Settings should show the new state without a restart.
    refetchOnWindowFocus: true,
  });
  const audio = useMutation({ mutationFn: native.checkSystemAudio });
  const model = useModelProgress();
  const models = useLocalModels();

  const items = describeReadiness({
    permissions: permissions.data ?? null,
    systemCheck: audio.isPending ? 'checking' : (audio.data ?? null),
    model,
    modelView: models.view(language),
    language,
  });

  const fix = useCallback(
    (_item: ReadinessItem, action: ReadinessFix) => {
      if (action.kind === 'pane') void native.openUrl(action.pane);
      else if (action.kind === 'test-audio') audio.mutate();
      else if (action.kind === 'download-model') void models.download(language);
      else retry();
    },
    [audio, retry, models, language],
  );

  return { items, fix };
}
