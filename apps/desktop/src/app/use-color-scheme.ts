import { followTheme } from '@cuelingo/ui/lib/theme';
import { useEffect } from 'react';

/** Keeps the `dark` class in step with the saved appearance choice (default: the system). */
export function useColorScheme(): void {
  useEffect(() => followTheme(), []);
}
