import { create } from 'zustand';
import { native } from '../lib/native';
import { transientOf, type Transient } from './model-state';

interface ModelStore {
  /** What the native side last said per language while a model came down (or failed to). */
  transient: Record<string, Transient>;
  set(language: string, value: Transient): void;
}

export const useModelStore = create<ModelStore>((set) => ({
  transient: {},
  set: (language, value) =>
    set((state) => ({ transient: { ...state.transient, [language]: value } })),
}));

let listening: Promise<void> | null = null;

/**
 * Listens to the model events once for the life of the app. A download goes on while its screen is closed, so
 * the store, not a screen, has to hear it: the next screen that opens shows the real state.
 */
export function listenForModelEvents(): Promise<void> {
  listening ??= native
    .onAudioModel((event) => {
      if (event.type === 'model') useModelStore.getState().set(event.language, transientOf(event));
    })
    .then(() => undefined)
    // Outside the Tauri shell (a browser preview) there is nothing to hear.
    .catch(() => {
      listening = null;
    });
  return listening;
}
