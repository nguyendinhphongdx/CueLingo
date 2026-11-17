import { useSyncExternalStore } from 'react';
import { readThemeMode, storeThemeMode, subscribeThemeMode, type ThemeMode } from '../lib/theme';

/** The saved appearance choice and a setter; every component using it updates together. */
export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const mode = useSyncExternalStore(
    subscribeThemeMode,
    () => readThemeMode(),
    () => 'system' as const,
  );
  return [mode, storeThemeMode];
}
