import { create } from 'zustand';
import { native } from '../lib/native';
import { applyModelEvent, type ModelEventLike, type Transient } from './model-state';

interface ModelStore {
  /** What the native side last said per language while a model came down (or failed to). */
  transient: Record<string, Transient>;
  set(language: string, value: Transient): void;
  clear(language: string): void;
  apply(event: ModelEventLike): void;
}

export const useModelStore = create<ModelStore>((set) => ({
  transient: {},
  set: (language, value) =>
    set((state) => ({ transient: { ...state.transient, [language]: value } })),
  clear: (language) =>
    set((state) => ({
      transient: Object.fromEntries(
        Object.entries(state.transient).filter(([code]) => code !== language),
      ),
    })),
  apply: (event) => set((state) => ({ transient: applyModelEvent(state.transient, event) })),
}));

let listening: Promise<void> | null = null;

/**
 * Listens to the model events once for the life of the app. A download goes on while its screen is closed, so
 * the store, not a screen, has to hear it: the next screen that opens shows the real state.
 */
export function listenForModelEvents(): Promise<void> {
  listening ??= native
    .onAudioModel((event) => {
      if (event.type === 'model') useModelStore.getState().apply(event);
    })
    .then(() => undefined)
    // Outside the Tauri shell (a browser preview) there is nothing to hear.
    .catch(() => {
      listening = null;
    });
  return listening;
}
