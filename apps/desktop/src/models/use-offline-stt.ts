import { useCallback, useEffect, useState } from 'react';
import { native, type LocalSttModelEvent, type LocalSttStatus } from '../lib/native';
import { isOfflineFallbackOn, setOfflineFallbackOn } from '../session/offline-fallback';
import { describeDownloadError, type ModelView } from './model-state';

/** The offline Vietnamese model for the Settings screen (ADR 0024): the switch, and the download behind it. */
export function useOfflineStt() {
  const [status, setStatus] = useState<LocalSttStatus | null | undefined>(undefined);
  const [event, setEvent] = useState<LocalSttModelEvent | null>(null);
  const [on, setOn] = useState(() => isOfflineFallbackOn());

  const refresh = useCallback(() => {
    native
      .localSttStatus()
      .then(setStatus)
      .catch(() => setStatus(null)); // outside the app (or an old build) there is nothing to manage
  }, []);

  useEffect(() => {
    refresh();
    let stop: (() => void) | undefined;
    let gone = false;
    void native
      .onLocalSttModel((next) => {
        setEvent(next);
        if (next.state === 'ready') refresh();
      })
      .then((unlisten) => {
        if (gone) unlisten();
        else stop = unlisten;
      })
      .catch(() => undefined);
    return () => {
      gone = true;
      stop?.();
    };
  }, [refresh]);

  const download = useCallback(() => {
    setEvent({ state: 'downloading', progress: 0 });
    native
      .localSttDownload()
      .catch((error) => setEvent({ state: 'error', message: String(error) }));
  }, []);

  const toggle = useCallback(
    (next: boolean) => {
      setOfflineFallbackOn(next);
      setOn(next);
      if (!next) void native.localSttUnload().catch(() => undefined);
      // Turning it on fetches the model when it is not here yet: nothing else would ever download it.
      else if (status?.state === 'missing') download();
    },
    [status, download],
  );

  let view: ModelView = { kind: 'checking' };
  if (status) {
    const sizeBytes = status.sizeBytes;
    if (event?.state === 'downloading') {
      view = { kind: 'downloading', sizeBytes, progress: event.progress };
    } else if (event?.state === 'error') {
      view = { kind: 'error', sizeBytes, message: describeDownloadError(event.message) };
    } else {
      view =
        status.state === 'ready' ? { kind: 'ready', sizeBytes } : { kind: 'missing', sizeBytes };
    }
  }
  return {
    available: status?.available ?? false,
    loaded: status !== undefined,
    on,
    view,
    toggle,
    download,
  };
}
