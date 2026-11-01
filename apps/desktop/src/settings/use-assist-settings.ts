import { useMutation } from '@tanstack/react-query';
import { native } from '../lib/native';
import { useSettings, type SelectableAssistLevel } from './settings-store';

export const saveAssistLevel = (level: SelectableAssistLevel) => native.setAssistLevel(level);

export function useAssistSettings() {
  const assistLevel = useSettings((state) => state.assistLevel);
  const setAssistLevel = useSettings((state) => state.setAssistLevel);
  const update = useMutation({
    mutationFn: saveAssistLevel,
    onSuccess: (_, level) => setAssistLevel(level),
  });

  return {
    assistLevel,
    setAssistLevel: update.mutate,
    saving: update.isPending,
    error: update.error ? 'Không thể đổi mức hỗ trợ. Vui lòng thử lại.' : null,
  };
}
