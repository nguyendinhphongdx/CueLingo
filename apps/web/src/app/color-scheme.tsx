'use client';

import { useEffect } from 'react';

/** Keeps shared brand tokens in sync with the browser's preferred appearance. */
export function ColorScheme() {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  return null;
}
