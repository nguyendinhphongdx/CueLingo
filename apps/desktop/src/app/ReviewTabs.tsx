import { ReviewTabsFrame } from '@cuelingo/ui/components/review-tabs-frame';
import { parseReviewTab, reviewTabForView, type ReviewTabId } from '@cuelingo/ui/lib/roadmap';
import { LearningPathPage, PhrasesPage, ReviewPage } from '../study';
import { ProgressPage } from '../insights';

/** The tab an old sidebar id (`review`, `phrases`, `progress`) opens, or null for any other view. */
export const tabForView = reviewTabForView;

/** The panel of one tab. */
export function ReviewPanel({ tab }: { tab: ReviewTabId }) {
  if (tab === 'phrases') return <PhrasesPage />;
  if (tab === 'progress') return <ProgressPage />;
  if (tab === 'path') return <LearningPathPage />;
  return <ReviewPage />;
}

/** Hôm nay, Kho cụm từ, Tiến độ and Lộ trình: one study area with four tabs. */
export function ReviewTabs({
  tab = 'today',
  onTab,
}: {
  tab?: string;
  onTab?: (tab: string) => void;
}) {
  const current = parseReviewTab(tab);
  return (
    <ReviewTabsFrame tab={current} onTab={(id) => onTab?.(id)}>
      <ReviewPanel tab={current} />
    </ReviewTabsFrame>
  );
}
