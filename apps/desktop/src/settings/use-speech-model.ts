import type { LanguageCode } from '@cuelingo/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  isCompiled,
  markCompiled,
  modelState,
  modelStepPlan,
  type SpeechModelState,
} from '../lib/model-state';
import { native } from '../lib/native';
import { useModelProgress } from '../session/model-progress';

/** What the person is told when starting the download is refused (the native side sends fixed codes). */
export function describePrewarmError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes('session_already_running'))
    return 'Đang có cuộc họp. Hãy thử lại sau khi họp xong.';
  return 'Kiểm tra kết nối mạng rồi thử lại.';
}

/** The on-device speech model for one language: its state, the download progress and how to (re)start it. */
export function useSpeechModel(language: LanguageCode): {
  state: SpeechModelState;
  progress: number;
  errorText?: string;
  start: () => Promise<void>;
} {
  const queryClient = useQueryClient();
  const event = useModelProgress();
  const plan = modelStepPlan(language);
  const version = useQuery({
    queryKey: ['app-version'],
    queryFn: async () => (await native.appInfo()).version,
    staleTime: Infinity,
  }).data;
  const status = useQuery({
    queryKey: ['stt-model-status', language],
    queryFn: () => native.speechModelStatus(language),
    enabled: plan === 'download',
    retry: false,
  });
  const [startError, setStartError] = useState<string | null>(null);

  const readyLanguage = event?.state === 'ready' ? event.language : null;
  useEffect(() => {
    if (readyLanguage !== language || !version) return;
    markCompiled(version, language);
    void queryClient.invalidateQueries({ queryKey: ['stt-model-status', language] });
  }, [readyLanguage, language, version, queryClient]);

  const state = startError
    ? 'error'
    : modelState({
        language,
        status: status.isError ? 'unknown' : (status.data ?? null),
        compiled: version ? isCompiled(version, language) : false,
        event,
      });

  const start = async () => {
    setStartError(null);
    try {
      await native.prewarmSpeech(language);
    } catch (error) {
      // A download that is already going is not a failure: its progress keeps arriving.
      if (error instanceof Error && error.message.includes('prewarm_already_running')) return;
      setStartError(describePrewarmError(error));
    }
  };

  return {
    state,
    progress: event?.language === language ? (event.progress ?? 0) : 0,
    errorText:
      startError ??
      (event?.state === 'error' && event.language === language
        ? 'Kiểm tra kết nối mạng rồi thử lại.'
        : undefined),
    start,
  };
}
