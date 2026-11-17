/** Appearance choice: follow the system, or force light or dark. Kept on this device only. */
export type ThemeMode = 'system' | 'light' | 'dark';

export const THEME_MODES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Theo hệ thống' },
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
];

export const THEME_STORAGE_KEY = 'cuelingo.theme';

export function parseThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** Whether the tokens should be dark for this mode, given the system preference. */
export function isDark(mode: ThemeMode, systemDark: boolean): boolean {
  return mode === 'system' ? systemDark : mode === 'dark';
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function readThemeMode(
  storage: Pick<Storage, 'getItem'> | undefined = safeStorage(),
): ThemeMode {
  try {
    return parseThemeMode(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function storeThemeMode(
  mode: ThemeMode,
  storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined = safeStorage(),
): void {
  try {
    if (mode === 'system') storage?.removeItem(THEME_STORAGE_KEY);
    else storage?.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Private mode or blocked storage: the choice just lasts until the app closes.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeThemeMode(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Keeps the `dark` class on <html> in step with the stored mode and the system preference.
 * Returns a function that stops following.
 */
export function followTheme(root: HTMLElement = document.documentElement): () => void {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => root.classList.toggle('dark', isDark(readThemeMode(), query.matches));
  apply();
  query.addEventListener('change', apply);
  const stop = subscribeThemeMode(apply);
  return () => {
    query.removeEventListener('change', apply);
    stop();
  };
}
