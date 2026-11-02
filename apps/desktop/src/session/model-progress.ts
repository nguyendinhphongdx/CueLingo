import { SUPPORTED_LANGUAGES, isLanguageCode } from '@cuelingo/shared';
import { useEffect, useState } from 'react';
import { native, type AudioModelEvent } from '../lib/native';

type ModelEvent = Extract<AudioModelEvent, { type: 'model' }>;

/** A short Vietnamese line for a model that is downloading; null once it is ready or when nothing is loading. */
export function describeModelProgress(event: ModelEvent | null): string | null {
  if (!event || event.state !== 'downloading') return null;
  const name = isLanguageCode(event.language)
    ? SUPPORTED_LANGUAGES[event.language].name
    : event.language;
  const percent = Math.round((event.progress ?? 0) * 100);
  return `Đang tải mô hình nhận dạng ${name.toLowerCase()}… ${percent}%`;
}

/** The latest speech-model event from the native side, for showing download progress. */
export function useModelProgress(): ModelEvent | null {
  const [event, setEvent] = useState<ModelEvent | null>(null);
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    native
      .onAudioModel((next) => {
        if (next.type === 'model') setEvent(next);
      })
      .then((unlisten) => {
        if (cancelled) unlisten();
        else stop = unlisten;
      })
      .catch(() => undefined); // outside the Tauri shell (browser preview) there is nothing to hear
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return event;
}
