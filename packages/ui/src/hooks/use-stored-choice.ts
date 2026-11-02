import { useCallback, useState } from 'react';

const read = (key: string, allowed: readonly string[], fallback: string): string => {
  try {
    const value = window.localStorage.getItem(key);
    return value !== null && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
};

/**
 * A choice that is remembered between visits (such as the language last used). Only values in
 * `allowed` are accepted, so an old or tampered value falls back instead of breaking a screen.
 */
export function useStoredChoice<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => read(key, allowed, fallback) as T);
  const choose = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Not remembered, but the choice still applies for this visit.
      }
    },
    [key],
  );
  return [value, choose];
}
