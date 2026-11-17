import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { native } from '../lib/native';
import { nativeErrorCode } from '../session/session-errors';
import { listenForModelEvents, useModelStore } from './model-store';
import { viewOf, type ModelView } from './model-state';

/**
 * What is downloaded on this machine, for every screen that cares (onboarding, Settings, the meeting page).
 * One source, so a download started on one screen shows as running on the others.
 */
export function useLocalModels() {
  const status = useQuery({
    queryKey: ['local-models'],
    queryFn: native.modelStatus,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const transient = useModelStore((state) => state.transient);

  useEffect(() => {
    void listenForModelEvents();
  }, []);

  // A finished download changes what is on disk: ask again, so a model that was `missing` turns `ready`.
  const finished = Object.values(transient).filter((value) => value.state === 'ready').length;
  const { refetch } = status;
  useEffect(() => {
    if (finished > 0) void refetch();
  }, [finished, refetch]);

  // `undefined` while the first answer is on its way; `null` when this build cannot manage models.
  const data = status.isError ? null : status.data;

  const download = useCallback(async (language: string) => {
    const store = useModelStore.getState();
    store.set(language, { state: 'downloading', progress: 0 });
    try {
      await native.downloadModel(language);
    } catch (error) {
      // Another download is already running for this model: keep showing it.
      if (nativeErrorCode(error) !== 'model_downloading') {
        store.set(language, { state: 'error', message: 'failed to start' });
      }
    }
  }, []);

  return {
    /** The model manager is available in this build. */
    supported: data !== null && data !== undefined,
    loading: data === undefined,
    view: (language: string): ModelView | null => viewOf(language, data, transient[language]),
    download,
  };
}
