'use client';

import type { LanguageCode } from '@cuelingo/shared';
import { LanguageSwitcher } from '@cuelingo/ui/components/language-switcher';
import { PageHeader } from '@cuelingo/ui/components/page-header';
import { ReviewTabsFrame } from '@cuelingo/ui/components/review-tabs-frame';
import { DEFAULT_REVIEW_TAB, parseReviewTab, type ReviewTabId } from '@cuelingo/ui/lib/roadmap';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useLanguage } from '../../lib/language';
import { PhraseBankPanel } from '../phrase-bank';
import { LearningPathTab } from '../learning-path';
import { ProgressPanel } from '../progress';
import { ReviewTodayPanel } from './ReviewPage';

/** Address of a tab: the default tab is the bare `/review`, the others carry `?tab=`. */
export function reviewTabHref(tab: ReviewTabId): string {
  return tab === DEFAULT_REVIEW_TAB ? '/review' : `/review?tab=${tab}`;
}

/** The page frame: title, language switcher, the tabs and the open tab's content. Presentation only. */
export function ReviewTabsView({
  tab,
  onTab,
  action,
  children,
}: {
  tab: ReviewTabId;
  onTab: (tab: ReviewTabId) => void;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader
        title="Ôn tập"
        description="Ôn lại cụm từ từ chính các cuộc họp của bạn."
        action={action}
      />
      <ReviewTabsFrame tab={tab} onTab={onTab} className="mt-4">
        {children}
      </ReviewTabsFrame>
    </>
  );
}

function Panel({ tab, language }: { tab: ReviewTabId; language: LanguageCode }) {
  if (tab === 'phrases') return <PhraseBankPanel language={language} />;
  if (tab === 'progress') return <ProgressPanel language={language} />;
  if (tab === 'path') {
    return (
      <LearningPathTab
        language={language}
        renderSitting={(source) => <ReviewTodayPanel language={language} source={source} />}
      />
    );
  }
  return <ReviewTodayPanel language={language} />;
}

/** `/review?tab=today|phrases|progress|path`: the tab lives in the address so a link, reload or back button keeps it. */
export function ReviewTabsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { language, setLanguage, options } = useLanguage();
  const tab = parseReviewTab(params.get('tab'));
  return (
    <ReviewTabsView
      tab={tab}
      onTab={(next) => router.replace(reviewTabHref(next), { scroll: false })}
      action={<LanguageSwitcher options={options} value={language} onChange={setLanguage} />}
    >
      <Panel tab={tab} language={language} />
    </ReviewTabsView>
  );
}

/** `/phrases` and `/progress` from before the merge: send the person to the tab that replaced them. */
export function LegacyReviewRedirect({ tab }: { tab: ReviewTabId }) {
  const router = useRouter();
  // The server redirect (next.config / _redirects) normally gets there first; this covers a plain static host.
  useEffect(() => {
    router.replace(reviewTabHref(tab));
  }, [router, tab]);
  return null;
}
