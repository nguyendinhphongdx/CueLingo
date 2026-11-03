import { useEffect, useSyncExternalStore } from 'react';
import { native } from '../lib/native';
import { createAudioLevelStore } from './audio-level-store';

const store = createAudioLevelStore({ listen: (callback) => native.onLevel(callback) });

/** Levels of both streams; listens only while `active` and clears when it turns false. */
export function useAudioLevels(active: boolean) {
  useEffect(() => {
    if (!active) return;
    store.start();
    return () => store.stop();
  }, [active]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
