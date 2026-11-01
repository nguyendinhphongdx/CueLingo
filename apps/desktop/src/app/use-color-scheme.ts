import { useEffect } from 'react';

/** Follows the macOS appearance: the shared UI kit switches theme tokens with a `dark` class. */
export function useColorScheme(): void {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);
}
