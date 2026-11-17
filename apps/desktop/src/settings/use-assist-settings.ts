import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { native } from '../lib/native';
import { useSettings, type SelectableAssistLevel } from './settings-store';
import { queueSettingsPatch } from './settings-api';
import { useSavedFlash } from './SavedIndicator';

export const saveAssistLevel = async (level: SelectableAssistLevel) => {
  await native.setAssistLevel(level);
  await native.publishSettings({ assistLevel: level });
  queueSettingsPatch({ assistDefault: level });
};

export function useAssistSettings() {
  const assistLevel = useSettings((state) => state.assistLevel);
  const setAssistLevel = useSettings((state) => state.setAssistLevel);
  const { saved, markSaved, reset } = useSavedFlash();
  const update = useMutation({
    mutationFn: saveAssistLevel,
    onMutate: reset,
    onSuccess: (_, level) => {
      setAssistLevel(level);
      markSaved();
    },
  });

  return {
    assistLevel,
    setAssistLevel: update.mutate,
    saving: update.isPending,
    saved,
    error: update.error ? 'Không thể đổi mức hỗ trợ. Vui lòng thử lại.' : null,
  };
}

/** The overlay can change the level too; follow it so both windows show the same choice. */
export function useSyncAssistLevel() {
  const setAssistLevel = useSettings((state) => state.setAssistLevel);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void native
      .onSettings(({ assistLevel }) => setAssistLevel(assistLevel as SelectableAssistLevel))
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [setAssistLevel]);
}
