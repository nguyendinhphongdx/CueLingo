import { useEffect, useState } from 'react';

export type OverlayTheme = 'light' | 'dark';

const KEYS = {
  fontSize: 'cuelingo.overlay.fontSize',
  opacity: 'cuelingo.overlay.opacity',
  theme: 'cuelingo.overlay.theme',
} as const;

export const FONT_SIZE = { min: 14, max: 28, default: 18 } as const;
export const OPACITY = { min: 55, max: 100, default: 88 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function read(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The overlay stays usable when storage is blocked or full.
  }
}

export const clampFontSize = (value: number) => clamp(value, FONT_SIZE.min, FONT_SIZE.max);
export const clampOpacity = (value: number) => clamp(value, OPACITY.min, OPACITY.max);

function readNumber(key: string, fallback: number, bound: (value: number) => number) {
  const stored = Number(read(key));
  return Number.isFinite(stored) && stored > 0 ? bound(stored) : fallback;
}

export const readFontSize = () => readNumber(KEYS.fontSize, FONT_SIZE.default, clampFontSize);
export const storeFontSize = (value: number) => write(KEYS.fontSize, String(value));

/** Display preferences of the overlay, kept per machine. */
export function useOverlayPrefs(initial: { fontSize?: number; theme?: OverlayTheme } = {}) {
  const [fontSize, setFontSize] = useState(() => clampFontSize(initial.fontSize ?? readFontSize()));
  const [opacity, setOpacity] = useState(() =>
    readNumber(KEYS.opacity, OPACITY.default, clampOpacity),
  );
  const [theme, setTheme] = useState<OverlayTheme>(() => {
    const stored = read(KEYS.theme);
    return initial.theme ?? (stored === 'light' ? 'light' : 'dark');
  });

  useEffect(() => storeFontSize(fontSize), [fontSize]);
  useEffect(() => write(KEYS.opacity, String(opacity)), [opacity]);
  useEffect(() => write(KEYS.theme, theme), [theme]);

  return {
    fontSize,
    opacity,
    theme,
    setFontSize: (value: number) => setFontSize(clampFontSize(value)),
    setOpacity: (value: number) => setOpacity(clampOpacity(value)),
    setTheme,
  };
}
