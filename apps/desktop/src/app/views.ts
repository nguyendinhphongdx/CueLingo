import type { ComponentType } from 'react';
import { GlossaryPage } from '../insights';
import { ReviewTabs } from './ReviewTabs';

/** What a page may receive: the tab of the page that has tabs. */
export interface ViewProps {
  tab?: string;
  onTab?: (tab: string) => void;
}

/**
 * Pages built into the desktop app, keyed by the feature id in `@cuelingo/ui/lib/roadmap`.
 * A feature without an entry here shows its "Sắp ra mắt" page. Add one line per finished page.
 * Hôm nay, Kho cụm từ and Tiến độ are the three tabs of `review`; the old ids open its tabs.
 */
export const views: Record<string, ComponentType<ViewProps>> = {
  review: ReviewTabs,
  glossary: GlossaryPage,
};
