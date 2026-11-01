import type { ComponentType } from 'react';

/**
 * Pages built into the desktop app, keyed by the feature id in `@cuelingo/ui/lib/roadmap`.
 * A feature without an entry here shows its "Sắp ra mắt" page. Add one line per finished page.
 */
export const views: Record<string, ComponentType> = {};
