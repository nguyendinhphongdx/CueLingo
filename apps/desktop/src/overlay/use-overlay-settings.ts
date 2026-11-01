import { useEffect, useState } from 'react';
import { native, type SettingsEvent } from '../lib/native';

type SettingsSource = Pick<typeof native, 'onSettings'>;

export function listenForOverlaySettings(
  callback: (event: SettingsEvent) => void,
  source: SettingsSource = native,
) {
  return source.onSettings(callback);
}

export function useOverlayAssistLevel(initialLevel = 4, enabled = true) {
  const [level, setLevel] = useState(initialLevel);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listenForOverlaySettings(({ assistLevel }) => setLevel(assistLevel)).then(
      (stopListening) => {
        if (disposed) stopListening();
        else unlisten = stopListening;
      },
    );

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [enabled]);

  return level;
}
