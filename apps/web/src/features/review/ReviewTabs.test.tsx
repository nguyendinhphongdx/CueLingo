import { LearningPathPanel } from '@cuelingo/ui/components/learning-path-panel';
import { REVIEW_TABS } from '@cuelingo/ui/lib/roadmap';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { ReviewTabsView, reviewTabHref } from './ReviewTabs';

describe('ReviewTabsView (AC11)', () => {
  const view = (tab: 'today' | 'phrases' | 'progress' | 'path') =>
    renderToStaticMarkup(
      <ReviewTabsView tab={tab} onTab={() => {}}>
        <p>nội dung</p>
      </ReviewTabsView>,
    );

  it('has the four tabs Hôm nay, Kho cụm từ, Tiến độ and Lộ trình under one Ôn tập title', () => {
    const markup = view('today');
    expect(markup).toContain('>Ôn tập<');
    for (const label of ['Hôm nay', 'Kho cụm từ', 'Tiến độ', 'Lộ trình'])
      expect(markup).toContain(`>${label}<`);
    expect(markup.match(/role="tab"/g)).toHaveLength(4);
    expect(REVIEW_TABS.map((t) => t.label)).toEqual([
      'Hôm nay',
      'Kho cụm từ',
      'Tiến độ',
      'Lộ trình',
    ]);
  });

  it('marks the open tab and ties the panel to it', () => {
    const markup = view('phrases');
    expect(markup).toMatch(/aria-selected="true"[^>]*>Kho cụm từ</);
    expect(markup).toContain('id="review-panel-phrases"');
    expect(markup).toContain('aria-labelledby="review-tab-phrases"');
    expect(markup).toContain('nội dung');
  });

  it('addresses each tab: the first is the bare /review', () => {
    expect(reviewTabHref('today')).toBe('/review');
    expect(reviewTabHref('phrases')).toBe('/review?tab=phrases');
    expect(reviewTabHref('progress')).toBe('/review?tab=progress');
    expect(reviewTabHref('path')).toBe('/review?tab=path');
  });

  it('keeps the other tabs reachable when the courses cannot load (AC9)', () => {
    const markup = renderToStaticMarkup(
      <ReviewTabsView tab="path" onTab={() => {}}>
        <LearningPathPanel
          data={undefined}
          error="Không kết nối được tới máy chủ"
          onStart={() => {}}
          onContinue={() => {}}
        />
      </ReviewTabsView>,
    );
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Không kết nối được tới máy chủ');
    for (const label of ['Hôm nay', 'Kho cụm từ', 'Tiến độ'])
      expect(markup).toContain(`>${label}<`);
    expect(markup.match(/role="tab"/g)).toHaveLength(4);
  });
});
