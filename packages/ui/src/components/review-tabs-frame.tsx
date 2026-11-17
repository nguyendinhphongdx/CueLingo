import type { ReactNode } from 'react';
import { REVIEW_TABS, type ReviewTabId } from '../lib/roadmap';
import { cn } from '../lib/utils';
import { Tabs } from './tabs';

const PREFIX = 'review';

/** The three Ôn tập tabs and the panel of the open one. Web and desktop both draw it, so they never disagree. */
export function ReviewTabsFrame({
  tab,
  onTab,
  className,
  children,
}: {
  tab: ReviewTabId;
  onTab: (tab: ReviewTabId) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <Tabs
        aria-label="Ôn tập"
        idPrefix={PREFIX}
        tabs={REVIEW_TABS.map(({ id, label }) => ({ id, label }))}
        value={tab}
        onChange={(id) => {
          const next = REVIEW_TABS.find((item) => item.id === id);
          if (next) onTab(next.id);
        }}
      />
      <div role="tabpanel" id={`${PREFIX}-panel-${tab}`} aria-labelledby={`${PREFIX}-tab-${tab}`}>
        {children}
      </div>
    </div>
  );
}
