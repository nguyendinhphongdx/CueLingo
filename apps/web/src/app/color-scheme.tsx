'use client';

import { followTheme } from '@cuelingo/ui/lib/theme';
import { useEffect } from 'react';

/** Keeps shared tokens in step with the saved appearance choice (default: the system). */
export function ColorScheme() {
  useEffect(() => followTheme(), []);
  return null;
}
